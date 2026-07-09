import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentClientTask } from '@ones-ai-workflow/shared';
import type { PreparedSourceWorkspace } from '../src/workspace/source.ts';
import type { PreparedWorkspace } from '../src/workspace/prepare.ts';
import { WorkspaceService } from '../src/workspace/service.ts';

test('WorkspaceService caches prepared source workspace and uses it for task workspace creation', async () => {
  const preparedSourceWorkspace = createPreparedSourceWorkspace('workspace-1');
  const prepareWorkspaceCalls: Array<{
    taskRoot: string;
    sourceWorkspace: PreparedSourceWorkspace | null;
  }> = [];

  const workspaceService = new WorkspaceService(
    {
      workingRoot: '/tmp/agent-client',
      sourceWorkspacesRoot: '/tmp/agent-client/source-workspaces'
    },
    {
      ensureTaskSourceWorkspace: async () => preparedSourceWorkspace,
      prepareWorkspace: async (taskRoot, sourceWorkspace) => {
        prepareWorkspaceCalls.push({
          taskRoot,
          sourceWorkspace
        });

        return createPreparedWorkspace(
          `${taskRoot}/workspace`,
          undefined,
          preparedSourceWorkspace.gitEnv
        );
      }
    }
  );

  await workspaceService.ensureSourceWorkspace(
    createTask('task-1', preparedSourceWorkspace.uuid)
  );

  const result = await workspaceService.prepareWorkspace({
    taskUUID: 'task-1',
    sourceWorkspaceUUID: preparedSourceWorkspace.uuid
  });

  assert.equal(result.workspaceRoot, '/tmp/agent-client/tasks/task-1/workspace');
  assert.deepEqual(result.gitEnv, preparedSourceWorkspace.gitEnv);
  assert.deepEqual(prepareWorkspaceCalls, [
    {
      taskRoot: '/tmp/agent-client/tasks/task-1',
      sourceWorkspace: preparedSourceWorkspace
    }
  ]);
});

test('WorkspaceService allows preparing a task workspace without source workspace', async () => {
  const workspaceService = new WorkspaceService(
    {
      workingRoot: '/tmp/agent-client',
      sourceWorkspacesRoot: '/tmp/agent-client/source-workspaces'
    },
    {
      ensureTaskSourceWorkspace: async () => null,
      prepareWorkspace: async (taskRoot, sourceWorkspace) => {
        assert.equal(taskRoot, '/tmp/agent-client/tasks/task-2');
        assert.equal(sourceWorkspace, null);
        return createPreparedWorkspace(`${taskRoot}/workspace`);
      }
    }
  );

  await workspaceService.ensureSourceWorkspace(createTask('task-2', null));

  const result = await workspaceService.prepareWorkspace({
    taskUUID: 'task-2',
    sourceWorkspaceUUID: null
  });

  assert.equal(result.workspaceRoot, '/tmp/agent-client/tasks/task-2/workspace');
  assert.deepEqual(result.gitEnv, {});
});

test('WorkspaceService throws when asked to prepare with unknown source workspace uuid', async () => {
  const workspaceService = new WorkspaceService({
    workingRoot: '/tmp/agent-client',
    sourceWorkspacesRoot: '/tmp/agent-client/source-workspaces'
  });

  await assert.rejects(
    () =>
      workspaceService.prepareWorkspace({
        taskUUID: 'task-3',
        sourceWorkspaceUUID: 'missing-workspace'
      }),
    /Prepared source workspace not found: missing-workspace/
  );
});

test('WorkspaceService cleans up previous and current prepared task workspaces', async () => {
  const cleanupCalls: string[] = [];
  let prepareCallCount = 0;

  const workspaceService = new WorkspaceService(
    {
      workingRoot: '/tmp/agent-client',
      sourceWorkspacesRoot: '/tmp/agent-client/source-workspaces'
    },
    {
      ensureTaskSourceWorkspace: async () => null,
      prepareWorkspace: async (taskRoot) => {
        prepareCallCount += 1;
        return createPreparedWorkspace(
          `${taskRoot}/workspace-${prepareCallCount}`,
          cleanupCalls
        );
      }
    }
  );

  await workspaceService.prepareWorkspace({
    taskUUID: 'task-4',
    sourceWorkspaceUUID: null
  });
  await workspaceService.prepareWorkspace({
    taskUUID: 'task-4',
    sourceWorkspaceUUID: null
  });
  await workspaceService.cleanupTaskWorkspace('task-4');

  assert.deepEqual(cleanupCalls, [
    '/tmp/agent-client/tasks/task-4/workspace-1',
    '/tmp/agent-client/tasks/task-4/workspace-2'
  ]);
});

function createTask(
  taskUUID: string,
  sourceWorkspaceUUID: string | null
): AgentClientTask {
  return {
    taskUUID,
    agent: {
      uuid: 'agent-1',
      name: 'Agent 1'
    },
    sourceWorkspace: sourceWorkspaceUUID
      ? {
          uuid: sourceWorkspaceUUID,
          name: 'Workspace 1',
          auth: {
            type: 'ssh',
            publicKey: 'ssh-ed25519 AAAAworkspace',
            privateKey:
              '-----BEGIN OPENSSH PRIVATE KEY-----\nworkspace\n-----END OPENSSH PRIVATE KEY-----\n'
          },
          repositories: []
        }
      : null,
    skillUUIDs: [],
    executeOption: {},
    prompt: `prompt for ${taskUUID}`
  };
}

function createPreparedSourceWorkspace(
  workspaceUUID: string
): PreparedSourceWorkspace {
  return {
    uuid: workspaceUUID,
    name: `Workspace ${workspaceUUID}`,
    workspaceRoot: `/tmp/source-workspaces/${workspaceUUID}`,
    repositoriesRoot: `/tmp/source-workspaces/${workspaceUUID}/repos`,
    gitEnv: {
      GIT_SSH_COMMAND: `ssh -i '/tmp/source-workspaces/${workspaceUUID}/.ssh/id_ed25519' -o IdentitiesOnly=yes`
    },
    repositories: []
  };
}

function createPreparedWorkspace(
  workspaceRoot: string,
  cleanupCalls?: string[],
  gitEnv: NodeJS.ProcessEnv = {}
): PreparedWorkspace {
  return {
    workspaceRoot,
    gitEnv,
    repos: [],
    cleanup: async () => {
      cleanupCalls?.push(workspaceRoot);
    }
  };
}
