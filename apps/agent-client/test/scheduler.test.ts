import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentClientTask } from '@ones-ai-workflow/shared';
import type { Auth } from '../src/auth/index.ts';
import type { CodexHomeService } from '../src/codex-home/index.ts';
import { Scheduler } from '../src/scheduler/index.ts';
import type { Skill } from '../src/skill/index.ts';
import type { TaskServer } from '../src/task-server/index.ts';
import {
  TaskServerAuthenticationError,
  TaskServerReportError,
  TaskServerRetryableError
} from '../src/task-server/index.ts';
import {
  TaskRun,
  type TaskRunInput
} from '../src/task-run/index.ts';
import type { TaskStore } from '../src/task-store/index.ts';
import type { Workspace } from '../src/workspace/index.ts';

test('Scheduler clears authentication when task server returns auth error', async () => {
  const auth: Auth = {
    async ensureAuthenticated() {},
    getAccessTokenOrThrow() {
      return 'token';
    },
    async clearAuthentication() {
      clearAuthenticationCalls += 1;
    }
  };
  let clearAuthenticationCalls = 0;

  const taskServer: TaskServer = {
    async claimTasks() {
      throw new TaskServerAuthenticationError('unauthorized');
    },
    async reportTasks() {},
    async fetchTaskRuntimeEnv() {
      return {
        env: {}
      };
    },
    async uploadTaskAttachments() {
      return {
        uploads: []
      };
    }
  };

  const scheduler = new Scheduler(
    auth,
    createTaskStoreStub({
      getAvailableSlots: () => 1
    }),
    taskServer,
    createWorkspaceStub(),
    createSkillStub(),
    createCodexHomeStub()
  );

  await scheduler.reloadPromise;
  await (scheduler as SchedulerWithInternals).handleLoopError(
    new TaskServerAuthenticationError('unauthorized')
  );

  assert.equal(scheduler.consecutiveErrors, 0);
  assert.equal(clearAuthenticationCalls, 1);
});

test('Scheduler backs off instead of exiting after consecutive retryable errors', async () => {
  const scheduler = new Scheduler(
    createAuthStub(),
    createTaskStoreStub(),
    createTaskServerStub(),
    createWorkspaceStub(),
    createSkillStub(),
    createCodexHomeStub()
  );

  await scheduler.reloadPromise;

  const retryDelays: number[] = [];

  for (let index = 0; index < 5; index += 1) {
    retryDelays.push(
      await (scheduler as SchedulerWithInternals).handleLoopError(
        new TaskServerRetryableError(`retryable-${index}`)
      )
    );
  }

  assert.deepEqual(retryDelays, [5_000, 10_000, 20_000, 40_000, 80_000]);
  assert.equal(scheduler.consecutiveErrors, 5);
});

test('Scheduler treats task report errors as warn-level loop errors', async () => {
  const scheduler = new Scheduler(
    createAuthStub(),
    createTaskStoreStub(),
    createTaskServerStub(),
    createWorkspaceStub(),
    createSkillStub(),
    createCodexHomeStub()
  );

  await scheduler.reloadPromise;

  const retryAfterMs = await (scheduler as SchedulerWithInternals).handleLoopError(
    new TaskServerReportError('invalid task report')
  );

  assert.equal(scheduler.consecutiveErrors, 1);
  assert.equal(retryAfterMs, 5_000);
});

test('Scheduler defers task execution when no codex home is available', async () => {
  const events: string[] = [];
  const scheduler = new Scheduler(
    createAuthStub(),
    createTaskStoreStub({
      deferTask(taskUUID, appendLogs) {
        events.push(`defer:${taskUUID}:${appendLogs}`);
        return {
          retryAfterMs: 5_000,
          nextAttemptAt: '2025-01-01T00:00:05.000Z'
        };
      }
    }),
    createTaskServerStub(),
    createWorkspaceStub({
      async ensureSourceWorkspace() {
        events.push('workspace.ensure');
      }
    }),
    createSkillStub({
      async ensureSkills() {
        events.push('skill.ensure');
      }
    }),
    createCodexHomeStub({
      async selectHome() {
        return {
          kind: 'deferred',
          message: '[codex-home] no available home'
        } as const;
      }
    })
  );

  await scheduler.reloadPromise;
  await (scheduler as SchedulerWithInternals).startTask(createTask('task-1'));

  assert.deepEqual(events, ['defer:task-1:[codex-home] no available home']);
});

test('Scheduler skips codex home selection when default agent is claude', async () => {
  const events: string[] = [];
  const scheduler = new Scheduler(
    createAuthStub(),
    createTaskStoreStub(),
    createTaskServerStub(),
    createWorkspaceStub({
      async ensureSourceWorkspace() {
        events.push('workspace.ensure');
      }
    }),
    createSkillStub({
      async ensureSkills() {
        events.push('skill.ensure');
      }
    }),
    createCodexHomeStub({
      async selectHome() {
        events.push('codex-home.select');
        return {
          kind: 'deferred',
          message: '[codex-home] no available home'
        } as const;
      }
    }),
    'claude'
  );

  const schedulerWithInternals = scheduler as SchedulerWithInternals & {
    runTask(
      task: AgentClientTask,
      codexHomePath: string | undefined,
      startLog: string
    ): Promise<void>;
  };
  schedulerWithInternals.runTask = async (_task, codexHomePath, startLog) => {
    events.push(`run:${codexHomePath ?? 'none'}:${startLog}`);
  };

  await scheduler.reloadPromise;
  await schedulerWithInternals.startTask(createTask('task-claude'));

  assert.deepEqual(events, [
    'workspace.ensure',
    'skill.ensure',
    'run:none:[agent-session] using default agent: claude'
  ]);
});

test('Scheduler does not pass Codex model options to Claude tasks', async () => {
  let capturedInput: TaskRunInput | undefined;
  const originalStart = TaskRun.prototype.start;
  TaskRun.prototype.start = function (this: TaskRun) {
    capturedInput = (this as unknown as { input: TaskRunInput }).input;
  };

  try {
    const scheduler = new Scheduler(
      createAuthStub(),
      createTaskStoreStub(),
      createTaskServerStub(),
      createWorkspaceStub(),
      createSkillStub(),
      createCodexHomeStub(),
      'claude',
      {
        codexModel: 'gpt-5.4',
        codexReasoningEffort: 'high'
      }
    );

    await scheduler.reloadPromise;
    await (scheduler as SchedulerWithInternals).startTask(
      createTask('task-claude-model')
    );

    assert.equal(capturedInput?.executeAgentType, 'claude');
    assert.equal(capturedInput?.model, undefined);
    assert.equal(capturedInput?.modelReasoningEffort, undefined);
  } finally {
    TaskRun.prototype.start = originalStart;
  }
});

test('Scheduler passes Hermes invocation options to Hermes tasks', async () => {
  let capturedInput: TaskRunInput | undefined;
  const originalStart = TaskRun.prototype.start;
  TaskRun.prototype.start = function (this: TaskRun) {
    capturedInput = (this as unknown as { input: TaskRunInput }).input;
  };

  try {
    const scheduler = new Scheduler(
      createAuthStub(),
      createTaskStoreStub(),
      createTaskServerStub(),
      createWorkspaceStub(),
      createSkillStub(),
      createCodexHomeStub(),
      'hermes',
      {
        codexModel: 'gpt-5.4',
        codexReasoningEffort: 'high',
        hermesExecutable: '/usr/local/bin/hermes',
        hermesProfile: 'coder',
        hermesModel: 'deepseek-v4-flash',
        hermesProvider: 'deepseek',
        hermesToolsets: 'terminal,filesystem'
      }
    );

    await scheduler.reloadPromise;
    await (scheduler as SchedulerWithInternals).startTask(
      createTask('task-hermes-model')
    );

    assert.equal(capturedInput?.executeAgentType, 'hermes');
    assert.equal(capturedInput?.hermesExecutablePath, '/usr/local/bin/hermes');
    assert.equal(capturedInput?.hermesProfile, 'coder');
    assert.equal(capturedInput?.model, 'deepseek-v4-flash');
    assert.equal(capturedInput?.hermesProvider, 'deepseek');
    assert.equal(capturedInput?.hermesToolsets, 'terminal,filesystem');
    assert.equal(capturedInput?.modelReasoningEffort, undefined);
  } finally {
    TaskRun.prototype.start = originalStart;
  }
});

test('Scheduler skips codex home selection when Codex API key is configured', async () => {
  const events: string[] = [];
  const scheduler = new Scheduler(
    createAuthStub(),
    createTaskStoreStub(),
    createTaskServerStub(),
    createWorkspaceStub({
      async ensureSourceWorkspace() {
        events.push('workspace.ensure');
      }
    }),
    createSkillStub({
      async ensureSkills() {
        events.push('skill.ensure');
      }
    }),
    createCodexHomeStub({
      async selectHome() {
        events.push('codex-home.select');
        return {
          kind: 'deferred',
          message: '[codex-home] no available home'
        } as const;
      }
    }),
    'codex',
    {
      codexApiKey: 'agent-client-key',
      codexBaseUrl: 'https://api.openai.com/v1',
      codexModel: 'gpt-5.4',
      codexReasoningEffort: 'high'
    }
  );

  const schedulerWithInternals = scheduler as SchedulerWithInternals & {
    runTask(
      task: AgentClientTask,
      codexHomePath: string | undefined,
      startLog: string
    ): Promise<void>;
  };
  schedulerWithInternals.runTask = async (_task, codexHomePath, startLog) => {
    events.push(`run:${codexHomePath ?? 'none'}:${startLog}`);
  };

  await scheduler.reloadPromise;
  assert.equal(scheduler.codexModel, 'gpt-5.4');
  assert.equal(scheduler.codexReasoningEffort, 'high');
  await schedulerWithInternals.startTask(createTask('task-codex-api-key'));

  assert.deepEqual(events, [
    'workspace.ensure',
    'skill.ensure',
    'run:none:[codex-auth] using API key'
  ]);
});

test('Scheduler discards only the rejected task when report returns non-retryable 4xx', async () => {
  const events: string[] = [];
  const scheduler = new Scheduler(
    createAuthStub(),
    createTaskStoreStub({
      getLatestReports() {
        return [
          {
            taskUUID: 'task-bad',
            status: 'failure',
            logs: 'bad logs',
            executeResult: '',
            startedAt: '2025-01-01T00:00:00.000Z',
            finishedAt: '2025-01-01T00:01:00.000Z'
          },
          {
            taskUUID: 'task-good',
            status: 'success',
            logs: 'good logs',
            executeResult: '<outputs />',
            startedAt: '2025-01-01T00:02:00.000Z',
            finishedAt: '2025-01-01T00:03:00.000Z'
          }
        ];
      },
      removeTasks(taskUUIDs) {
        events.push(`remove:${taskUUIDs.join(',')}`);
      },
      markTaskReported(taskUUID) {
        events.push(`reported:${taskUUID}`);
      }
    }),
    createTaskServerStub({
      async reportTasks({ tasks }) {
        events.push(`report:${tasks[0]?.taskUUID}`);

        if (tasks[0]?.taskUUID === 'task-bad') {
          throw new TaskServerReportError('invalid task report');
        }
      }
    }),
    createWorkspaceStub(),
    createSkillStub(),
    createCodexHomeStub()
  );

  await scheduler.reloadPromise;
  await (scheduler as SchedulerWithInternals).flushLatestReports();

  assert.deepEqual(events, [
    'report:task-bad',
    'remove:task-bad',
    'report:task-good',
    'reported:task-good'
  ]);
});

type SchedulerWithInternals = Scheduler & {
  claimNewTasks(): Promise<void>;
  flushLatestReports(): Promise<void>;
  handleLoopError(error: unknown): Promise<number>;
  startTask(task: AgentClientTask): Promise<void>;
};

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

function createTaskServerStub(overrides?: Partial<TaskServer>): TaskServer {
  return {
    async claimTasks() {
      return [];
    },
    async reportTasks() {},
    async fetchTaskRuntimeEnv() {
      return {
        env: {}
      };
    },
    async uploadTaskAttachments() {
      return {
        uploads: []
      };
    },
    ...overrides
  };
}

function createTaskStoreStub(overrides?: Partial<TaskStore>): TaskStore {
  return {
    async reload() {},
    getAvailableSlots() {
      return 0;
    },
    getAvailableClaimSlots() {
      return 0;
    },
    insertNewTasks(_tasks: AgentClientTask[]) {},
    listRunnableTasks() {
      return [];
    },
    getLatestReports() {
      return [];
    },
    markTaskReported(_taskUUID: string) {},
    removeTasks(_taskUUIDs: string[]) {},
    deferTask() {
      return {
        retryAfterMs: 5_000,
        nextAttemptAt: '2025-01-01T00:00:05.000Z'
      };
    },
    updateTaskStatus() {},
    ...overrides
  };
}

function createCodexHomeStub(
  overrides?: Partial<CodexHomeService>
): CodexHomeService {
  return {
    async selectHome() {
      return {
        kind: 'selected',
        homePath: '/Users/liwei/.codex-a',
        message: '[codex-home] selected home: /Users/liwei/.codex-a'
      } as const;
    },
    ...overrides
  } as CodexHomeService;
}

function createWorkspaceStub(overrides?: Partial<Workspace> = {}): Workspace {
  return {
    async ensureSourceWorkspace() {},
    async prepareWorkspace() {
      return {
        workspaceRoot: '/tmp/workspace',
        gitEnv: {}
      };
    },
    async cleanupTaskWorkspace() {},
    ...overrides
  };
}

function createSkillStub(overrides?: Partial<Skill> = {}): Skill {
  return {
    async ensureSkills() {},
    async mountSkills() {},
    ...overrides
  };
}

function createTask(taskUUID: string): AgentClientTask {
  return {
    taskUUID,
    agent: {
      uuid: 'agent-1',
      name: 'Agent 1'
    },
    sourceWorkspace: null,
    skillUUIDs: [],
    executeOption: {},
    prompt: `prompt for ${taskUUID}`
  };
}
