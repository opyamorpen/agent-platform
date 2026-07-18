import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AgentClientTask,
  AgentClientTaskAttachmentOutput,
  AgentClientVerificationProfileResult,
  AgentClientWorkspacePatchUpload,
  AgentClientTaskReport,
  AgentClientTaskStatus,
  AgentTokenUsage
} from '@ones-ai-workflow/shared';
import { getCodexHomeRetryDelayMs } from '../codex-home/index.js';
import { logger } from '../logger.js';
import type { TaskStoreService as TaskStoreContract } from './types.js';

interface StoredTaskRecord {
  task: AgentClientTask;
  status: AgentClientTaskStatus;
  logs: string;
  executeResult: string;
  attachmentUploads?: AgentClientTaskAttachmentOutput[];
  verificationResults?: AgentClientVerificationProfileResult[];
  workspacePatch?: AgentClientWorkspacePatchUpload;
  usage: AgentTokenUsage | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  nextAttemptAt: string | null;
  homeRetryCount: number;
  reportedAt: string | null;
}

export interface TaskStoreServiceOptions {
  workingRoot: string;
  maxConcurrency: number;
}

export interface TaskStoreServiceDependencies {
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  readdir: typeof readdir;
  removeFile: (targetPath: string) => Promise<void>;
  removeDirectory: (targetPath: string) => Promise<void>;
  writeFile: typeof writeFile;
  now: () => string;
}

const defaultDependencies: TaskStoreServiceDependencies = {
  mkdir,
  readFile,
  readdir,
  removeFile: async (targetPath: string) => {
    await rm(targetPath, { force: true });
  },
  removeDirectory: async (targetPath: string) => {
    await rm(targetPath, { recursive: true, force: true });
  },
  writeFile,
  now: () => new Date().toISOString()
};

export class TaskStoreFileService implements TaskStoreContract {
  private readonly dependencies: TaskStoreServiceDependencies;
  private readonly tasksById = new Map<string, StoredTaskRecord>();
  private readonly taskOrder: string[] = [];

  constructor(
    private readonly options: TaskStoreServiceOptions,
    dependencies?: Partial<TaskStoreServiceDependencies>
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  async reload(): Promise<void> {
    await this.ensureStoreDirectory();
    this.tasksById.clear();
    this.taskOrder.length = 0;

    const entryNames = await this.dependencies.readdir(this.getTasksDirectoryPath());
    const fileNames = entryNames
      .filter((entryName) => entryName.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));

    for (const fileName of fileNames) {
      const filePath = path.join(this.getTasksDirectoryPath(), fileName);

      try {
        const content = await this.dependencies.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content) as Partial<StoredTaskRecord>;
        const record = toStoredTaskRecord(parsed);
        const normalizedRecord = normalizeRecoveredTaskRecord(record, this.dependencies.now());

        this.tasksById.set(normalizedRecord.task.taskUUID, normalizedRecord);
        this.taskOrder.push(normalizedRecord.task.taskUUID);

        if (normalizedRecord !== record) {
          await this.cleanupRecoveredTaskWorkspace(record.task.taskUUID);
          await this.persistTaskRecord(normalizedRecord);
        }
      } catch {
        continue;
      }
    }
  }

  getAvailableSlots(): number {
    const runningCount = this.countTasksByStatus('running');
    return Math.max(this.options.maxConcurrency - runningCount, 0);
  }

  getAvailableClaimSlots(): number {
    const activeCount = this.countTasksByStatuses(['queued', 'running']);
    return Math.max(this.options.maxConcurrency - activeCount, 0);
  }

  insertNewTasks(tasks: AgentClientTask[]): void {
    for (const task of tasks) {
      if (this.tasksById.has(task.taskUUID)) {
        continue;
      }

      const record: StoredTaskRecord = {
        task,
        status: 'queued',
        logs: '',
        executeResult: '',
        attachmentUploads: undefined,
        verificationResults: undefined,
        workspacePatch: undefined,
        usage: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: this.dependencies.now(),
        nextAttemptAt: null,
        homeRetryCount: 0,
        reportedAt: null
      };

      this.tasksById.set(task.taskUUID, record);
      this.taskOrder.push(task.taskUUID);
      void this.persistTaskRecord(record);
    }
  }

  listRunnableTasks(): AgentClientTask[] {
    const availableSlots = this.getAvailableSlots();
    const now = this.dependencies.now();

    if (availableSlots <= 0) {
      return [];
    }

    const tasks: AgentClientTask[] = [];

    for (const taskUUID of this.taskOrder) {
      const record = this.tasksById.get(taskUUID);

      if (
        !record ||
        record.status !== 'queued' ||
        !isRunnableAt(record.nextAttemptAt, now)
      ) {
        continue;
      }

      tasks.push(record.task);

      if (tasks.length >= availableSlots) {
        break;
      }
    }

    return tasks;
  }

  getLatestReports(): AgentClientTaskReport[] {
    const reports: AgentClientTaskReport[] = [];

    for (const taskUUID of this.taskOrder) {
      const record = this.tasksById.get(taskUUID);

      if (!record) {
        continue;
      }

      if (
        record.reportedAt === null &&
        (record.status === 'running' ||
          record.status === 'success' ||
          record.status === 'failure')
      ) {
        reports.push({
          taskUUID: record.task.taskUUID,
          status: record.status,
          logs: record.logs,
          executeResult: record.executeResult,
          attachmentUploads: record.attachmentUploads,
          verificationResults: record.verificationResults,
          workspacePatch: record.workspacePatch,
          usage: record.usage,
          startedAt: record.startedAt,
          finishedAt: record.finishedAt
        });
      }
    }

    return reports;
  }

  markTaskReported(taskUUID: string): void {
    const record = this.tasksById.get(taskUUID);

    if (!record) {
      return;
    }

    const now = this.dependencies.now();
    const nextRecord: StoredTaskRecord = {
      ...record,
      reportedAt: now,
      updatedAt: now
    };

    this.tasksById.set(taskUUID, nextRecord);
    void this.persistTaskRecord(nextRecord);
  }

  removeTasks(taskUUIDs: string[]): void {
    for (const taskUUID of taskUUIDs) {
      this.tasksById.delete(taskUUID);
      removeArrayValue(this.taskOrder, taskUUID);
      void this.dependencies.removeFile(this.getTaskFilePath(taskUUID));
    }
  }

  deferTask(
    taskUUID: string,
    appendLogs?: string
  ): { retryAfterMs: number; nextAttemptAt: string } {
    const record = this.tasksById.get(taskUUID);

    if (!record) {
      throw new Error(`Task record not found: ${taskUUID}`);
    }

    const nextRetryCount = record.homeRetryCount + 1;
    const retryAfterMs = getCodexHomeRetryDelayMs(nextRetryCount);
    const nextAttemptAt = new Date(
      Date.parse(this.dependencies.now()) + retryAfterMs
    ).toISOString();
    const reason = appendLogs?.trim();
    const nextLogs = [record.logs, reason && `${reason}; retry after ${retryAfterMs}ms`]
      .filter(Boolean)
      .join('\n');
    const nextRecord: StoredTaskRecord = {
      ...record,
      status: 'queued',
      logs: nextLogs,
      nextAttemptAt,
      homeRetryCount: nextRetryCount,
      updatedAt: this.dependencies.now(),
      reportedAt: null
    };

    this.tasksById.set(taskUUID, nextRecord);
    void this.persistTaskRecord(nextRecord);

    return {
      retryAfterMs,
      nextAttemptAt
    };
  }

  updateTaskStatus(
    taskUUID: string,
    status: AgentClientTaskStatus,
    appendLogs?: string,
    executeResult?: string,
    attachmentUploads?: AgentClientTaskAttachmentOutput[],
    usage?: AgentTokenUsage | null,
    verificationResults?: AgentClientVerificationProfileResult[],
    workspacePatch?: AgentClientWorkspacePatchUpload
  ): void {
    const record = this.tasksById.get(taskUUID);

    if (!record) {
      throw new Error(`Task record not found: ${taskUUID}`);
    }

    const normalizedLogs = appendLogs?.trim();
    const nextLogs = normalizedLogs
      ? record.logs
        ? `${record.logs}\n${normalizedLogs}`
        : normalizedLogs
      : record.logs;
    const startedAt =
      status === 'running' ? record.startedAt ?? this.dependencies.now() : record.startedAt;
    const finishedAt =
      status === 'success' || status === 'failure'
        ? this.dependencies.now()
        : record.finishedAt;
    const nextRecord: StoredTaskRecord = {
      ...record,
      status,
      logs: nextLogs,
      executeResult: executeResult ?? record.executeResult,
      attachmentUploads: attachmentUploads ?? record.attachmentUploads,
      verificationResults: verificationResults ?? record.verificationResults,
      workspacePatch: workspacePatch ?? record.workspacePatch,
      usage: usage !== undefined ? usage : record.usage,
      startedAt,
      finishedAt,
      updatedAt: this.dependencies.now(),
      nextAttemptAt: status === 'running' ? null : record.nextAttemptAt,
      homeRetryCount: status === 'running' ? 0 : record.homeRetryCount,
      reportedAt: null
    };

    this.tasksById.set(taskUUID, nextRecord);
    void this.persistTaskRecord(nextRecord);
  }

  private countTasksByStatus(status: AgentClientTaskStatus): number {
    return this.countTasksByStatuses([status]);
  }

  private countTasksByStatuses(statuses: AgentClientTaskStatus[]): number {
    let count = 0;

    for (const record of this.tasksById.values()) {
      if (statuses.includes(record.status)) {
        count += 1;
      }
    }

    return count;
  }

  private async persistTaskRecord(record: StoredTaskRecord): Promise<void> {
    await this.ensureStoreDirectory();
    await this.dependencies.writeFile(
      this.getTaskFilePath(record.task.taskUUID),
      JSON.stringify(record, null, 2),
      'utf8'
    );
  }

  private async ensureStoreDirectory(): Promise<void> {
    await this.dependencies.mkdir(this.getTasksDirectoryPath(), { recursive: true });
  }

  private async cleanupRecoveredTaskWorkspace(taskUUID: string): Promise<void> {
    const taskRootPath = this.getTaskRootPath(taskUUID);

    try {
      await this.dependencies.removeDirectory(taskRootPath);
    } catch (error) {
      logger.warn('Failed to cleanup recovered task workspace', {
        taskUUID,
        taskRootPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private getTasksDirectoryPath(): string {
    return path.join(this.options.workingRoot, 'task-store', 'tasks');
  }

  private getTaskRootPath(taskUUID: string): string {
    return path.join(this.options.workingRoot, 'tasks', taskUUID);
  }

  private getTaskFilePath(taskUUID: string): string {
    return path.join(this.getTasksDirectoryPath(), `${taskUUID}.json`);
  }
}

function toStoredTaskRecord(value: Partial<StoredTaskRecord>): StoredTaskRecord {
  if (!value.task?.taskUUID || !value.status || !value.updatedAt) {
    throw new Error('Invalid stored task record');
  }

  return {
    task: value.task,
    status: value.status,
    logs: typeof value.logs === 'string' ? value.logs : '',
    executeResult: typeof value.executeResult === 'string' ? value.executeResult : '',
    attachmentUploads: Array.isArray(value.attachmentUploads)
      ? value.attachmentUploads
      : undefined,
    verificationResults: Array.isArray(value.verificationResults)
      ? value.verificationResults
      : undefined,
    workspacePatch:
      value.workspacePatch && typeof value.workspacePatch === 'object'
        ? value.workspacePatch
        : undefined,
    usage: isAgentTokenUsage(value.usage) ? value.usage : null,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    updatedAt: value.updatedAt,
    nextAttemptAt:
      typeof value.nextAttemptAt === 'string' ? value.nextAttemptAt : null,
    homeRetryCount:
      typeof value.homeRetryCount === 'number' && value.homeRetryCount > 0
        ? value.homeRetryCount
        : 0,
    reportedAt: typeof value.reportedAt === 'string' ? value.reportedAt : null
  };
}

function isAgentTokenUsage(value: unknown): value is AgentTokenUsage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const usage = value as {
    inputTokens?: unknown;
    outputTokens?: unknown;
  };

  return (
    isNullableNumber(usage.inputTokens) &&
    isNullableNumber(usage.outputTokens)
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function normalizeRecoveredTaskRecord(
  record: StoredTaskRecord,
  now: string
): StoredTaskRecord {
  if (record.status !== 'running') {
    return record;
  }

  const recoveryMessage =
    '[task-store] recovered running task after restart; rescheduled';

  return {
    ...record,
    status: 'queued',
    logs: record.logs ? `${record.logs}\n${recoveryMessage}` : recoveryMessage,
    nextAttemptAt: null,
    homeRetryCount: 0,
    reportedAt: null,
    updatedAt: now
  };
}

function isRunnableAt(nextAttemptAt: string | null, now: string): boolean {
  if (!nextAttemptAt) {
    return true;
  }

  return Date.parse(nextAttemptAt) <= Date.parse(now);
}

function removeArrayValue(items: string[], target: string) {
  const index = items.indexOf(target);

  if (index >= 0) {
    items.splice(index, 1);
  }
}
