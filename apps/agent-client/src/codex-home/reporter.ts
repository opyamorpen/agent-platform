import { getLogger } from '../logger.js';
import type { CodexHomeService, CodexHomeStatus } from './service.js';

const logger = getLogger('codex-home');
const DEFAULT_REPORT_INTERVAL_MS = 60_000;

export interface CodexHomeReporterOptions {
  intervalMs?: number;
}

export interface CodexHomeReporterDependencies {
  setInterval: typeof setInterval;
  logInfo: (message: string) => void;
  logWarn: (message: string, context?: Record<string, unknown>) => void;
}

const defaultDependencies: CodexHomeReporterDependencies = {
  setInterval,
  logInfo: (message) => {
    logger.info(message);
  },
  logWarn: (message, context) => {
    logger.warn(message, context);
  }
};

export class CodexHomeReporter {
  private readonly intervalMs: number;
  private readonly dependencies: CodexHomeReporterDependencies;

  constructor(
    private readonly codexHomeService: CodexHomeService,
    options?: CodexHomeReporterOptions,
    dependencies?: Partial<CodexHomeReporterDependencies>
  ) {
    this.intervalMs = options?.intervalMs ?? DEFAULT_REPORT_INTERVAL_MS;
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  start(): void {
    void this.report();

    const timer = this.dependencies.setInterval(() => {
      void this.report();
    }, this.intervalMs);

    timer.unref?.();
  }

  private async report(): Promise<void> {
    try {
      const statuses = await this.codexHomeService.getHomeStatuses();
      this.dependencies.logInfo(this.formatStatusTable(statuses));
    } catch (error) {
      this.dependencies.logWarn('Failed to report codex home statuses', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private formatStatusTable(statuses: CodexHomeStatus[]): string {
    const columns = [
      {
        key: 'home',
        title: 'home',
        maxWidth: 48
      },
      {
        key: 'account',
        title: 'account',
        maxWidth: 32
      },
      {
        key: 'status',
        title: 'status',
        maxWidth: 12
      },
      {
        key: 'remaining5h',
        title: '5h remaining',
        maxWidth: 12
      },
      {
        key: 'remaining7d',
        title: '7d remaining',
        maxWidth: 12
      },
      {
        key: 'detail',
        title: 'detail',
        maxWidth: 72
      }
    ] as const;

    const rows = statuses.map((status) => {
      const hasQuota =
        typeof status.remaining5hPercent === 'number' &&
        typeof status.remaining7dPercent === 'number';

      return {
        home: status.homePath,
        account: status.account,
        status: status.available ? 'available' : 'unavailable',
        remaining5h: hasQuota ? `${status.remaining5hPercent}%` : '-',
        remaining7d: hasQuota ? `${status.remaining7dPercent}%` : '-',
        detail: status.reason ?? '-'
      };
    });

    const widths = columns.map((column) => {
      const longestCell = rows.reduce((maxWidth, row) => {
        return Math.max(maxWidth, this.formatCell(row[column.key], column.maxWidth).length);
      }, column.title.length);

      return Math.min(column.maxWidth, longestCell);
    });
    const horizontalBorder = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
    const header = this.formatTableRow(
      columns.map((column) => column.title),
      widths
    );
    const body = rows.map((row) =>
      this.formatTableRow(
        columns.map((column) => this.formatCell(row[column.key], column.maxWidth)),
        widths
      )
    );

    return [
      '[codex-home] status summary',
      horizontalBorder,
      header,
      horizontalBorder,
      ...body,
      horizontalBorder
    ].join('\n');
  }

  private formatTableRow(values: string[], widths: number[]): string {
    return `| ${values.map((value, index) => value.padEnd(widths[index], ' ')).join(' | ')} |`;
  }

  private formatCell(value: string, maxWidth: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim() || '-';

    if (normalized.length <= maxWidth) {
      return normalized;
    }

    if (maxWidth <= 3) {
      return '.'.repeat(maxWidth);
    }

    return `${normalized.slice(0, maxWidth - 3)}...`;
  }
}
