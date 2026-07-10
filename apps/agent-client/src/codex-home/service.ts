import { readFile } from 'node:fs/promises';
import { getLogger } from '../logger.js';

const logger = getLogger('codex-home');
const WHAM_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const BACKOFF_STEPS_MS = [5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000];

type WhamUsageResponse = {
  email?: string;
  account_id?: string;
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: {
      used_percent?: number;
    };
    secondary_window?: {
      used_percent?: number;
    };
  };
};

type CodexAuthFile = {
  tokens?: {
    access_token?: string;
    account_id?: string;
  };
};

export type CodexHomeStatus = {
  homePath: string;
  account: string;
  available: boolean;
  remaining5hPercent: number | null;
  remaining7dPercent: number | null;
  reason: string | null;
};

export type SelectCodexHomeResult =
  | {
      kind: 'selected';
      homePath: string;
      message: string;
    }
  | {
      kind: 'deferred';
      message: string;
    };

export interface CodexHomeServiceDependencies {
  fetch: typeof fetch;
  readFile: typeof readFile;
}

const defaultDependencies: CodexHomeServiceDependencies = {
  fetch,
  readFile
};

export class CodexHomeService {
  private readonly dependencies: CodexHomeServiceDependencies;
  private roundRobinCursor = 0;

  constructor(
    private readonly codexHomes: string[],
    dependencies?: Partial<CodexHomeServiceDependencies>
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  async selectHome(): Promise<SelectCodexHomeResult> {
    const statuses = await this.getHomeStatuses();
    const availableHomes = statuses.filter(
      (status): status is CodexHomeStatus & {
        available: true;
        remaining5hPercent: number;
        remaining7dPercent: number;
      } =>
        status.available &&
        typeof status.remaining5hPercent === 'number' &&
        typeof status.remaining7dPercent === 'number'
    );

    if (availableHomes.length === 0) {
      return {
        kind: 'deferred',
        message: '[codex-home] no available home'
      };
    }

    const rankedHomes = availableHomes
      .map((home) => ({
        ...home,
        roundRobinRank: getRoundRobinRank(
          this.codexHomes,
          home.homePath,
          this.roundRobinCursor
        )
      }))
      .sort((left, right) => {
        if (left.remaining5hPercent !== right.remaining5hPercent) {
          return right.remaining5hPercent - left.remaining5hPercent;
        }

        if (left.remaining7dPercent !== right.remaining7dPercent) {
          return right.remaining7dPercent - left.remaining7dPercent;
        }

        return left.roundRobinRank - right.roundRobinRank;
      });
    const selectedHome = rankedHomes[0];
    const selectedIndex = this.codexHomes.indexOf(selectedHome.homePath);

    if (selectedIndex >= 0) {
      this.roundRobinCursor = (selectedIndex + 1) % this.codexHomes.length;
    }

    return {
      kind: 'selected',
      homePath: selectedHome.homePath,
      message: `[codex-home] selected home: ${selectedHome.homePath} (5h remaining ${selectedHome.remaining5hPercent}%, 7d remaining ${selectedHome.remaining7dPercent}%)`
    };
  }

  async getHomeStatuses(): Promise<CodexHomeStatus[]> {
    return Promise.all(
      this.codexHomes.map(async (homePath) => this.probeHome(homePath))
    );
  }

  private async probeHome(homePath: string): Promise<CodexHomeStatus> {
    let account = 'unknown';

    try {
      const auth = await this.readAuthTokens(homePath);
      account = auth.accountId;
      const usage = await this.fetchUsage(auth.accessToken, auth.accountId);
      account = usage.email?.trim() || usage.account_id?.trim() || auth.accountId;
      const remaining5hPercent = toRemainingPercent(
        usage.rate_limit?.primary_window?.used_percent ?? 100
      );
      const remaining7dPercent = toRemainingPercent(
        usage.rate_limit?.secondary_window?.used_percent ?? 100
      );
      const available =
        usage.rate_limit?.allowed === true &&
        usage.rate_limit?.limit_reached !== true;

      return {
        homePath,
        account,
        available,
        remaining5hPercent,
        remaining7dPercent,
        reason: available ? null : 'rate limited'
      };
    } catch (error) {
      logger.warn('Failed to probe codex home', {
        homePath,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        homePath,
        account,
        available: false,
        remaining5hPercent: null,
        remaining7dPercent: null,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async readAuthTokens(homePath: string): Promise<{
    accessToken: string;
    accountId: string;
  }> {
    const authFilePath = `${homePath}/auth.json`;
    const content = await this.dependencies.readFile(authFilePath, 'utf8');
    const parsed = JSON.parse(content) as CodexAuthFile;
    const accessToken = parsed.tokens?.access_token?.trim();
    const accountId = parsed.tokens?.account_id?.trim();

    if (!accessToken || !accountId) {
      throw new Error(`Invalid auth file: ${authFilePath}`);
    }

    return {
      accessToken,
      accountId
    };
  }

  private async fetchUsage(
    accessToken: string,
    accountId: string
  ): Promise<WhamUsageResponse> {
    const response = await this.dependencies.fetch(WHAM_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'ChatGPT-Account-Id': accountId,
        Accept: 'application/json',
        Origin: 'https://chatgpt.com',
        Referer: 'https://chatgpt.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Usage request failed: ${response.status}`);
    }

    return (await response.json()) as WhamUsageResponse;
  }
}

export function getCodexHomeRetryDelayMs(retryCount: number): number {
  if (retryCount <= 0) {
    return BACKOFF_STEPS_MS[0];
  }

  return BACKOFF_STEPS_MS[Math.min(retryCount - 1, BACKOFF_STEPS_MS.length - 1)];
}

function getRoundRobinRank(
  homes: string[],
  homePath: string,
  cursor: number
): number {
  const index = homes.indexOf(homePath);

  if (index < 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (index - cursor + homes.length) % homes.length;
}

function toRemainingPercent(usedPercent: number): number {
  return Math.max(0, 100 - usedPercent);
}
