import type {
  AgentClientTask,
  AgentClientTaskAttachmentUploadResponse,
  AgentClientTaskRuntimeEnvResponse,
  AgentClientTaskReport
} from '@ones-ai-workflow/shared';

export interface TaskServer {
  claimTasks: (options: {
    availableSlots: number;
  }) => Promise<AgentClientTask[]>;
  reportTasks: (options: { tasks: AgentClientTaskReport[] }) => Promise<void>;
  fetchTaskRuntimeEnv: (options: {
    taskUUID: string;
  }) => Promise<AgentClientTaskRuntimeEnvResponse>;
  uploadTaskAttachments: (options: {
    taskUUID: string;
    files: Array<{
      localPath: string;
      fileName: string;
      bytes: Uint8Array;
      contentType?: string;
    }>;
  }) => Promise<AgentClientTaskAttachmentUploadResponse>;
}

export { TaskServerService } from './service.js';
export {
  TaskServerAuthenticationError,
  TaskServerError,
  TaskServerFatalError,
  TaskServerReportError,
  TaskServerRetryableError
} from './service.js';

export type {
  TaskServerServiceDependencies,
  TaskServerServiceOptions
} from './service.js';
