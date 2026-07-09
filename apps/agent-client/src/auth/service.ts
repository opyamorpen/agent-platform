import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import * as path from 'node:path';
import type {
  AgentClientConnectPollResponse,
  AgentClientConnectRequest,
  AgentClientConnectResponse
} from '@ones-ai-workflow/shared';
import { connectToServer, pollServerConnection } from '../api.js';
import { logger } from '../logger.js';
import type { Auth } from './index.js';

interface StoredAgentClientAuthState {
  clientUUID: string;
  clientName: string;
  accessToken: string;
  issuedAt: string;
}

export interface AuthServiceOptions {
  clientUUID: string;
  clientName: string;
  clientVersion: string;
  serverBaseUrl: string;
  workingRoot: string;
}

export interface AuthServiceDependencies {
  connectToServer: (
    serverBaseUrl: string,
    request: AgentClientConnectRequest
  ) => Promise<AgentClientConnectResponse>;
  pollServerConnection: (
    serverBaseUrl: string,
    request: {
      clientUUID: string;
      connectionRequestUUID: string;
      connectCode: string;
    }
  ) => Promise<AgentClientConnectPollResponse>;
  getHostname: () => string;
  createConnectCode: () => string;
  sleep: (ms: number) => Promise<void>;
  readFile: typeof readFile;
  writeFile: typeof writeFile;
  removeFile: (filePath: string) => Promise<void>;
}

const defaultDependencies: AuthServiceDependencies = {
  connectToServer,
  pollServerConnection,
  getHostname: () => hostname(),
  createConnectCode: () => `${randomUUID()}${randomUUID()}`,
  sleep: (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  readFile,
  writeFile,
  removeFile: async (filePath: string) => {
    await rm(filePath, { force: true });
  }
};

export class AuthService implements Auth {
  private authState: StoredAgentClientAuthState | null = null;
  private isLoaded = false;
  private authPromise: Promise<void> | null = null;
  private readonly dependencies: AuthServiceDependencies;

  constructor(
    private readonly options: AuthServiceOptions,
    dependencies?: Partial<AuthServiceDependencies>
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  async ensureAuthenticated(): Promise<void> {
    await this.loadAuthState();

    if (this.authState?.accessToken) {
      return;
    }

    if (!this.authPromise) {
      this.authPromise = this.performAuthentication().finally(() => {
        this.authPromise = null;
      });
    }

    await this.authPromise;
  }

  getAccessTokenOrThrow(): string {
    if (!this.authState?.accessToken) {
      throw new Error('Agent client access token is unavailable');
    }

    return this.authState.accessToken;
  }

  async clearAuthentication(): Promise<void> {
    this.authState = null;
    this.isLoaded = true;
    await this.dependencies.removeFile(this.getAuthFilePath());
  }

  private async performAuthentication(): Promise<void> {
    const connectCode = this.dependencies.createConnectCode();
    const connectResponse = await this.dependencies.connectToServer(
      this.options.serverBaseUrl,
      {
        client: {
          uuid: this.options.clientUUID,
          name: this.options.clientName,
          hostname: this.dependencies.getHostname(),
          version: this.options.clientVersion
        },
        connectCode
      }
    );

    logger.info('Agent client connection request created', {
      clientUUID: this.options.clientUUID,
      connectionRequestUUID: connectResponse.connectionRequestUUID
    });

    let pollAfterMs = connectResponse.pollAfterMs;

    while (true) {
      await this.dependencies.sleep(pollAfterMs);

      const pollResponse = await this.dependencies.pollServerConnection(
        this.options.serverBaseUrl,
        {
          clientUUID: this.options.clientUUID,
          connectionRequestUUID: connectResponse.connectionRequestUUID,
          connectCode
        }
      );

      if (pollResponse.status === 'pending_approval') {
        pollAfterMs = pollResponse.pollAfterMs;
        continue;
      }

      if (pollResponse.status === 'revoked') {
        throw new Error(pollResponse.message);
      }

      this.authState = {
        clientUUID: this.options.clientUUID,
        clientName: this.options.clientName,
        accessToken: pollResponse.accessToken,
        issuedAt: new Date().toISOString()
      };
      await this.dependencies.writeFile(
        this.getAuthFilePath(),
        JSON.stringify(this.authState, null, 2),
        'utf8'
      );
      this.isLoaded = true;

      logger.info('Agent client connection approved', {
        clientUUID: this.options.clientUUID
      });
      return;
    }
  }

  private async loadAuthState(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    this.isLoaded = true;

    try {
      const content = await this.dependencies.readFile(this.getAuthFilePath(), 'utf8');
      const parsed = JSON.parse(content) as Partial<StoredAgentClientAuthState>;

      if (
        typeof parsed.clientUUID === 'string' &&
        parsed.clientUUID === this.options.clientUUID &&
        typeof parsed.clientName === 'string' &&
        typeof parsed.accessToken === 'string' &&
        parsed.accessToken.trim() !== '' &&
        typeof parsed.issuedAt === 'string'
      ) {
        this.authState = {
          clientUUID: parsed.clientUUID,
          clientName: parsed.clientName,
          accessToken: parsed.accessToken,
          issuedAt: parsed.issuedAt
        };
      }
    } catch {
      this.authState = null;
    }
  }

  private getAuthFilePath(): string {
    return path.join(this.options.workingRoot, 'auth.json');
  }
}
