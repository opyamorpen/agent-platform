import type { AgentClientTask } from '@ones-ai-workflow/shared';

export interface PrepareWorkspaceInput {
  taskUUID: string;
  sourceWorkspaceUUID: string | null;
}

export interface PrepareWorkspaceResult {
  workspaceRoot: string;
  gitEnv: NodeJS.ProcessEnv;
  repos?: Array<{
    uuid: string;
    name: string;
    worktreePath: string;
  }>;
}

export interface Workspace {
  ensureSourceWorkspace(task: AgentClientTask): Promise<void>;
  prepareWorkspace(
    input: PrepareWorkspaceInput
  ): Promise<PrepareWorkspaceResult>;
  cleanupTaskWorkspace(taskUUID: string): Promise<void>;
}

export { WorkspaceService } from './service.js';

export type {
  WorkspaceServiceDependencies,
  WorkspaceServiceOptions
} from './service.js';
