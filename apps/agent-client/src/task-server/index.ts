import type {
  AgentClientTask,
  AgentClientTaskAttachmentUploadResponse,
  AgentClientWorkspacePatchUploadResponse,
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
  uploadTaskWorkspacePatch?: (options: {
    taskUUID: string;
    bytes: Uint8Array;
  }) => Promise<AgentClientWorkspacePatchUploadResponse>;
  downloadPreviousWorkspacePatch?: (options: {
    downloadPath: string;
  }) => Promise<Uint8Array>;
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
