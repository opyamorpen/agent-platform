import * as path from 'node:path';
import type { AgentClientTask } from '@ones-ai-workflow/shared';
import {
  ensureTaskSourceWorkspace,
  type PreparedSourceWorkspace
} from './source.js';
import {
  prepareWorkspace as prepareTaskWorkspace,
  type PreparedWorkspace
} from './prepare.js';
import type {
  PrepareWorkspaceInput,
  PrepareWorkspaceResult,
  Workspace
} from './index.js';

export interface WorkspaceServiceOptions {
  workingRoot: string;
  sourceWorkspacesRoot: string;
}

export interface WorkspaceServiceDependencies {
  ensureTaskSourceWorkspace: (
    sourceWorkspacesRoot: string,
    sourceWorkspace: AgentClientTask['sourceWorkspace']
  ) => Promise<PreparedSourceWorkspace | null>;
  prepareWorkspace: (
    taskRoot: string,
    sourceWorkspace: PreparedSourceWorkspace | null
  ) => Promise<PreparedWorkspace>;
}

const defaultDependencies: WorkspaceServiceDependencies = {
  ensureTaskSourceWorkspace,
  prepareWorkspace: prepareTaskWorkspace
};

export class WorkspaceService implements Workspace {
  private readonly dependencies: WorkspaceServiceDependencies;
  private readonly preparedSourceWorkspaces = new Map<string, PreparedSourceWorkspace>();
  private readonly preparedTaskWorkspaces = new Map<string, PreparedWorkspace>();

  constructor(
    private readonly options: WorkspaceServiceOptions,
    dependencies?: Partial<WorkspaceServiceDependencies>
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  async ensureSourceWorkspace(task: AgentClientTask): Promise<void> {
    const preparedSourceWorkspace = await this.dependencies.ensureTaskSourceWorkspace(
      this.options.sourceWorkspacesRoot,
      task.sourceWorkspace
    );

    if (!task.sourceWorkspace?.uuid || !preparedSourceWorkspace) {
      return;
    }

    this.preparedSourceWorkspaces.set(task.sourceWorkspace.uuid, preparedSourceWorkspace);
  }

  async prepareWorkspace(
    input: PrepareWorkspaceInput
  ): Promise<PrepareWorkspaceResult> {
    const existingWorkspace = this.preparedTaskWorkspaces.get(input.taskUUID);

    if (existingWorkspace) {
      await existingWorkspace.cleanup();
      this.preparedTaskWorkspaces.delete(input.taskUUID);
    }

    const sourceWorkspace = this.resolvePreparedSourceWorkspace(
      input.sourceWorkspaceUUID
    );
    const taskRoot = path.join(this.options.workingRoot, 'tasks', input.taskUUID);
    const preparedWorkspace = await this.dependencies.prepareWorkspace(
      taskRoot,
      sourceWorkspace
    );

    this.preparedTaskWorkspaces.set(input.taskUUID, preparedWorkspace);

    return {
      workspaceRoot: preparedWorkspace.workspaceRoot,
      gitEnv: preparedWorkspace.gitEnv
    };
  }

  async cleanupTaskWorkspace(taskUUID: string): Promise<void> {
    const preparedWorkspace = this.preparedTaskWorkspaces.get(taskUUID);

    if (!preparedWorkspace) {
      return;
    }

    this.preparedTaskWorkspaces.delete(taskUUID);
    await preparedWorkspace.cleanup();
  }

  private resolvePreparedSourceWorkspace(
    sourceWorkspaceUUID: string | null
  ): PreparedSourceWorkspace | null {
    if (!sourceWorkspaceUUID) {
      return null;
    }

    const preparedSourceWorkspace =
      this.preparedSourceWorkspaces.get(sourceWorkspaceUUID);

    if (!preparedSourceWorkspace) {
      throw new Error(
        `Prepared source workspace not found: ${sourceWorkspaceUUID}`
      );
    }

    return preparedSourceWorkspace;
  }
}
