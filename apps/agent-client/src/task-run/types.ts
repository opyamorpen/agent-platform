import type {
  AgentTokenUsage,
  AgentClientTaskAttachmentOutput,
  AgentClientTaskRuntimeEnvResponse,
  AgentClientTaskAttachmentUploadResponse,
  AgentClientPreviousWorkspacePatch,
  AgentClientVerificationProfileResult,
  AgentClientWorkspacePatchUpload,
  AgentClientWorkspacePatchUploadResponse,
  WorkspaceVerificationProfile
} from '@ones-ai-workflow/shared';
import type {
  ExecuteAgentType,
  ModelReasoningEffort
} from '../agent-session/types.js';

export interface TaskRunInput {
  taskUUID: string;
  sourceWorkspaceUUID: string | null;
  skillUUIDs: string[];
  prompt: string;
  executeAgentType?: ExecuteAgentType;
  codexHomePath?: string;
  codexApiKey?: string;
  codexBaseUrl?: string;
  hermesExecutablePath?: string;
  hermesProfile?: string;
  hermesProvider?: string;
  hermesToolsets?: string;
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  executeOption?: Record<string, unknown>;
  verificationProfiles?: WorkspaceVerificationProfile[];
  previousWorkspacePatch?: AgentClientPreviousWorkspacePatch | null;
}

export interface TaskRunCallback {
  onProgress: (info: { logs: string }) => void;
  onError(
    error: Error,
    usage: AgentTokenUsage | null,
    verificationResults?: AgentClientVerificationProfileResult[],
    workspacePatch?: AgentClientWorkspacePatchUpload
  ): void;
  onFinish: (
    result: string,
    attachmentUploads?: AgentClientTaskAttachmentOutput[],
    usage?: AgentTokenUsage | null,
    verificationResults?: AgentClientVerificationProfileResult[],
    workspacePatch?: AgentClientWorkspacePatchUpload
  ) => void;
}
export interface TaskRunDependencies {
  createAgentSession: (
    input: {
      workspaceRoot: string;
      prompt: string;
      env?: Record<string, string>;
      codexHomePath?: string;
      codexApiKey?: string;
      codexBaseUrl?: string;
      hermesExecutablePath?: string;
      hermesProfile?: string;
      hermesProvider?: string;
      hermesToolsets?: string;
      model?: string;
      modelReasoningEffort?: ModelReasoningEffort;
    },
    executeAgentType?: ExecuteAgentType
  ) => {
    execute(
      onProgress: (info: { logs: string }) => void
    ): Promise<{
      result: string;
      usage: AgentTokenUsage | null;
    }>;
    abort(): Promise<void> | void;
  };
  listWorkspaceRepoNames: (workspaceRoot: string) => Promise<string[]>;
  listMountedSkillNames: (workspaceRoot: string) => Promise<string[]>;
  fetchTaskRuntimeEnv: (
    taskUUID: string
  ) => Promise<AgentClientTaskRuntimeEnvResponse>;
  uploadTaskAttachments: (
    taskUUID: string,
    files: TaskRunAttachmentUploadFile[]
  ) => Promise<AgentClientTaskAttachmentUploadResponse>;
  downloadPreviousWorkspacePatch: (
    patch: AgentClientPreviousWorkspacePatch
  ) => Promise<Uint8Array>;
  uploadTaskWorkspacePatch: (
    taskUUID: string,
    bytes: Uint8Array
  ) => Promise<AgentClientWorkspacePatchUploadResponse>;
}

export interface TaskRunAttachmentUploadFile {
  localPath: string;
  fileName: string;
  bytes: Uint8Array;
  contentType?: string;
}
