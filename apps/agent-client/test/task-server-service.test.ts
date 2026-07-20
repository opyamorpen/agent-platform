import { AgentClientApiError } from '../src/api.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Auth } from '../src/auth/index.ts';
import {
  TaskServerAuthenticationError,
  TaskServerReportError,
  TaskServerRetryableError,
  TaskServerService
} from '../src/task-server/service.ts';

test('TaskServerService claims tasks after ensuring authentication', async () => {
  const callOrder: string[] = [];
  const auth = createAuthStub({
    ensureAuthenticated: async () => {
      callOrder.push('ensureAuthenticated');
    },
    getAccessTokenOrThrow: () => {
      callOrder.push('getAccessTokenOrThrow');
      return 'access-token';
    }
  });

  const taskServer = new TaskServerService(
    {
      serverBaseUrl: 'http://server.test',
      auth
    },
    {
      claimTasksFromServer: async (serverBaseUrl, accessToken, request) => {
        callOrder.push('claimTasksFromServer');
        assert.equal(serverBaseUrl, 'http://server.test');
        assert.equal(accessToken, 'access-token');
        assert.deepEqual(request, {
          availableSlots: 3,
          capabilities: ['task-lease-v1', 'skill-version-pinning-v1']
        });

        return {
          tasks: [
            {
              taskUUID: 'task-1',
              agent: {
                uuid: 'agent-1',
                name: 'Agent 1'
              },
              sourceWorkspace: null,
              skillUUIDs: [],
              executeOption: {},
              prompt: 'do work'
            }
          ]
        };
      }
    }
  );

  const tasks = await taskServer.claimTasks({
    availableSlots: 3
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.taskUUID, 'task-1');
  assert.deepEqual(callOrder, [
    'ensureAuthenticated',
    'getAccessTokenOrThrow',
    'claimTasksFromServer'
  ]);
});

test('TaskServerService reports tasks after ensuring authentication', async () => {
  const callOrder: string[] = [];
  const auth = createAuthStub({
    ensureAuthenticated: async () => {
      callOrder.push('ensureAuthenticated');
    },
    getAccessTokenOrThrow: () => {
      callOrder.push('getAccessTokenOrThrow');
      return 'access-token';
    }
  });

  const taskServer = new TaskServerService(
    {
      serverBaseUrl: 'http://server.test',
      auth
    },
    {
      reportTaskStatusToServer: async (serverBaseUrl, accessToken, request) => {
        callOrder.push('reportTaskStatusToServer');
        assert.equal(serverBaseUrl, 'http://server.test');
        assert.equal(accessToken, 'access-token');
        assert.deepEqual(request, {
          reports: [
            {
              taskUUID: 'task-1',
              status: 'success',
              logs: 'done',
              executeResult: '<outputs>done</outputs>',
              usage: {
                inputTokens: 8,
                outputTokens: 3
              },
              startedAt: '2025-01-01T00:00:00.000Z',
              finishedAt: '2025-01-01T00:01:00.000Z'
            }
          ]
        });

        return {
          accepted: true
        };
      }
    }
  );

  await taskServer.reportTasks({
    tasks: [
      {
        taskUUID: 'task-1',
        status: 'success',
        logs: 'done',
        executeResult: '<outputs>done</outputs>',
        usage: {
          inputTokens: 8,
          outputTokens: 3
        },
        startedAt: '2025-01-01T00:00:00.000Z',
        finishedAt: '2025-01-01T00:01:00.000Z'
      }
    ]
  });

  assert.deepEqual(callOrder, [
    'ensureAuthenticated',
    'getAccessTokenOrThrow',
    'reportTaskStatusToServer'
  ]);
});

test('TaskServerService fetches runtime env after ensuring authentication', async () => {
  const callOrder: string[] = [];
  const auth = createAuthStub({
    ensureAuthenticated: async () => {
      callOrder.push('ensureAuthenticated');
    },
    getAccessTokenOrThrow: () => {
      callOrder.push('getAccessTokenOrThrow');
      return 'access-token';
    }
  });

  const taskServer = new TaskServerService(
    {
      serverBaseUrl: 'http://server.test',
      auth
    },
    {
      fetchTaskRuntimeEnvFromServer: async (serverBaseUrl, accessToken, taskUUID) => {
        callOrder.push('fetchTaskRuntimeEnvFromServer');
        assert.equal(serverBaseUrl, 'http://server.test');
        assert.equal(accessToken, 'access-token');
        assert.equal(taskUUID, 'task-1');
        return {
          env: {
            OPENAI_API_KEY: 'secret-token'
          }
        };
      }
    }
  );

  const response = await taskServer.fetchTaskRuntimeEnv({
    taskUUID: 'task-1'
  });

  assert.deepEqual(response, {
    env: {
      OPENAI_API_KEY: 'secret-token'
    }
  });
  assert.deepEqual(callOrder, [
    'ensureAuthenticated',
    'getAccessTokenOrThrow',
    'fetchTaskRuntimeEnvFromServer'
  ]);
});

test('TaskServerService maps 401 into TaskServerAuthenticationError', async () => {
  const auth = createAuthStub();
  const taskServer = new TaskServerService(
    {
      serverBaseUrl: 'http://server.test',
      auth
    },
    {
      claimTasksFromServer: async () => {
        throw new AgentClientApiError(
          'unauthorized',
          401,
          'POST',
          'http://server.test/api/agent-clients/tasks/claim'
        );
      }
    }
  );

  await assert.rejects(
    () =>
      taskServer.claimTasks({
        availableSlots: 1
      }),
    (error) =>
      error instanceof TaskServerAuthenticationError &&
      error.message === 'unauthorized'
  );
});

test('TaskServerService maps 5xx into TaskServerRetryableError', async () => {
  const auth = createAuthStub();
  const taskServer = new TaskServerService(
    {
      serverBaseUrl: 'http://server.test',
      auth
    },
    {
      reportTaskStatusToServer: async () => {
        throw new AgentClientApiError(
          'server unavailable',
          503,
          'POST',
          'http://server.test/api/agent-clients/tasks/report'
        );
      }
    }
  );

  await assert.rejects(
    () =>
      taskServer.reportTasks({
        tasks: []
      }),
    (error) =>
      error instanceof TaskServerRetryableError &&
      error.message === 'server unavailable'
  );
});

test('TaskServerService maps non-auth 4xx task report errors into TaskServerReportError', async () => {
  const auth = createAuthStub();
  const taskServer = new TaskServerService(
    {
      serverBaseUrl: 'http://server.test',
      auth
    },
    {
      reportTaskStatusToServer: async () => {
        throw new AgentClientApiError(
          'invalid task report',
          400,
          'POST',
          'http://server.test/api/agent-clients/tasks/report',
          '{"success":false,"message":"invalid task report"}'
        );
      }
    }
  );

  await assert.rejects(
    () =>
      taskServer.reportTasks({
        tasks: []
      }),
    (error) =>
      error instanceof TaskServerReportError &&
      error.message === 'invalid task report'
  );
});

function createAuthStub(overrides?: Partial<Auth>): Auth {
  return {
    async ensureAuthenticated() {},
    getAccessTokenOrThrow() {
      return 'token';
    },
    async clearAuthentication() {},
    ...overrides
  };
}
