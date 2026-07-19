import type {
  AgentClientTask,
  AgentClientTaskAttachmentUploadResponse,
  AgentClientTaskRuntimeEnvResponse,
  AgentClientTaskReport
} from '@ones-ai-workflow/shared';
import {
  AgentClientApiError,
  claimTasksFromServer,
  fetchTaskRuntimeEnvFromServer,
  reportTaskStatusToServer,
  uploadTaskAttachmentsToServer
} from '../api.js';
import type { Auth } from '../auth/index.js';
import { logger } from '../logger.js';
import type { TaskServer } from './index.js';

export interface TaskServerServiceOptions {
  serverBaseUrl: string;
  auth: Auth;
}

export interface TaskServerServiceDependencies {
  claimTasksFromServer: (
    serverBaseUrl: string,
    accessToken: string,
    request: {
      availableSlots: number;
    }
  ) => Promise<{ tasks: AgentClientTask[] }>;
  reportTaskStatusToServer: (
    serverBaseUrl: string,
    accessToken: string,
    request: { reports: AgentClientTaskReport[] }
  ) => Promise<{ accepted: true }>;
  fetchTaskRuntimeEnvFromServer: (
    serverBaseUrl: string,
    accessToken: string,
    taskUUID: string
  ) => Promise<AgentClientTaskRuntimeEnvResponse>;
  uploadTaskAttachmentsToServer: (
    serverBaseUrl: string,
    accessToken: string,
    taskUUID: string,
    files: Array<{
      localPath: string;
      fileName: string;
      bytes: Uint8Array;
      contentType?: string;
    }>
  ) => Promise<AgentClientTaskAttachmentUploadResponse>;
}

const defaultDependencies: TaskServerServiceDependencies = {
  claimTasksFromServer,
  reportTaskStatusToServer,
  fetchTaskRuntimeEnvFromServer,
  uploadTaskAttachmentsToServer
};

export class TaskServerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'TaskServerError';

    if (options && 'cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export class TaskServerAuthenticationError extends TaskServerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TaskServerAuthenticationError';
  }
}

export class TaskServerRetryableError extends TaskServerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TaskServerRetryableError';
  }
}

export class TaskServerReportError extends TaskServerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TaskServerReportError';
  }
}

export class TaskServerFatalError extends TaskServerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TaskServerFatalError';
  }
}

export class TaskServerService implements TaskServer {
  private readonly dependencies: TaskServerServiceDependencies;

  constructor(
    private readonly options: TaskServerServiceOptions,
    dependencies?: Partial<TaskServerServiceDependencies>
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  async claimTasks(options: {
    availableSlots: number;
  }): Promise<AgentClientTask[]> {
    const accessToken = await this.ensureAccessToken();
    const response = await this.runWithErrorMapping(() =>
      this.dependencies.claimTasksFromServer(
        this.options.serverBaseUrl,
        accessToken,
        { availableSlots: options.availableSlots }
      )
    );

    return response.tasks;
  }

  async reportTasks(options: {
    tasks: AgentClientTaskReport[];
  }): Promise<void> {
    const accessToken = await this.ensureAccessToken();
    try {
      await this.dependencies.reportTaskStatusToServer(
        this.options.serverBaseUrl,
        accessToken,
        {
          reports: options.tasks
        }
      );
    } catch (error) {
      logTaskReportFailure(error, options.tasks);
      throw toTaskServerReportError(error);
    }
  }

  async fetchTaskRuntimeEnv(options: {
    taskUUID: string;
  }): Promise<AgentClientTaskRuntimeEnvResponse> {
    const accessToken = await this.ensureAccessToken();
    return this.runWithErrorMapping(() =>
      this.dependencies.fetchTaskRuntimeEnvFromServer(
        this.options.serverBaseUrl,
        accessToken,
        options.taskUUID
      )
    );
  }

  async uploadTaskAttachments(options: {
    taskUUID: string;
    files: Array<{
      localPath: string;
      fileName: string;
      bytes: Uint8Array;
      contentType?: string;
    }>;
  }): Promise<AgentClientTaskAttachmentUploadResponse> {
    const accessToken = await this.ensureAccessToken();
    return this.runWithErrorMapping(() =>
      this.dependencies.uploadTaskAttachmentsToServer(
        this.options.serverBaseUrl,
        accessToken,
        options.taskUUID,
        options.files
      )
    );
  }

  private async ensureAccessToken(): Promise<string> {
    await this.options.auth.ensureAuthenticated();
    return this.options.auth.getAccessTokenOrThrow();
  }

  private async runWithErrorMapping<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      throw toTaskServerError(error);
    }
  }
}

function toTaskServerError(error: unknown): TaskServerError {
  if (error instanceof TaskServerError) {
    return error;
  }

  if (error instanceof AgentClientApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new TaskServerAuthenticationError(error.message, { cause: error });
    }

    if (error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500) {
      return new TaskServerRetryableError(error.message, { cause: error });
    }

    return new TaskServerFatalError(error.message, { cause: error });
  }

  return new TaskServerRetryableError(
    error instanceof Error ? error.message : String(error),
    { cause: error }
  );
}

function toTaskServerReportError(error: unknown): TaskServerError {
  if (error instanceof TaskServerError) {
    return error;
  }

  if (error instanceof AgentClientApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new TaskServerAuthenticationError(error.message, { cause: error });
    }

    if (error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500) {
      return new TaskServerRetryableError(error.message, { cause: error });
    }

    return new TaskServerReportError(error.message, { cause: error });
  }

  return new TaskServerRetryableError(
    error instanceof Error ? error.message : String(error),
    { cause: error }
  );
}

function logTaskReportFailure(
  error: unknown,
  tasks: AgentClientTaskReport[]
): void {
  const requestBody = JSON.stringify({ reports: tasks });

  if (error instanceof AgentClientApiError) {
    logger.warn('Agent client task report request failed', {
      method: error.method,
      url: error.url,
      statusCode: error.statusCode,
      error: error.message,
      requestBody,
      responseBody: error.responseBody ?? ''
    });
    return;
  }

  logger.warn('Agent client task report request failed', {
    error: error instanceof Error ? error.message : String(error),
    requestBody
  });
}
