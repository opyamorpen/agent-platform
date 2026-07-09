import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentClientTask } from '@ones-ai-workflow/shared';
import { TaskStoreFileService } from '../src/task-store/service.ts';

test('TaskStoreService returns startable queued tasks within available slots', async () => {
  const taskStore = new TaskStoreFileService(
    {
      workingRoot: '/tmp/agent-client',
      maxConcurrency: 2
    },
    {
      mkdir: async () => undefined,
      writeFile: async () => undefined
    }
  );

  taskStore.insertNewTasks([
    createTask('task-1'),
    createTask('task-2'),
    createTask('task-3')
  ]);
  taskStore.updateTaskStatus('task-1', 'running');

  const runnableTasks = taskStore.listRunnableTasks();

  assert.deepEqual(
    runnableTasks.map((task) => task.taskUUID),
    ['task-2']
  );
  assert.equal(taskStore.getAvailableSlots(), 1);
  assert.equal(taskStore.getAvailableClaimSlots(), 0);
});

test('TaskStoreService derives reports from current task states', async () => {
  const taskStore = new TaskStoreFileService(
    {
      workingRoot: '/tmp/agent-client',
      maxConcurrency: 2
    },
    {
      mkdir: async () => undefined,
      writeFile: async () => undefined
    }
  );

  taskStore.insertNewTasks([createTask('task-1'), createTask('task-2')]);
  taskStore.updateTaskStatus('task-1', 'running', '[task-run] started');
  taskStore.updateTaskStatus(
    'task-2',
    'success',
    '[task-run] finished',
    '<outputs>ok</outputs>',
    [
      {
        outputName: 'attachments',
        uploads: [
          {
            resourceToken: 'token-1',
            fileName: 'report.md',
            localPath: 'artifacts/report.md'
          }
        ]
      }
    ],
    {
      inputTokens: 13,
      outputTokens: 21
    }
  );

  const reports = taskStore.getLatestReports();

  assert.deepEqual(
    reports.map((report) => ({
      taskUUID: report.taskUUID,
      status: report.status,
      executeResult: report.executeResult
    })),
    [
      {
        taskUUID: 'task-1',
        status: 'running',
        executeResult: ''
      },
      {
        taskUUID: 'task-2',
        status: 'success',
        executeResult: '<outputs>ok</outputs>'
      }
    ]
  );
  assert.deepEqual(reports[1]?.attachmentUploads, [
    {
      outputName: 'attachments',
      uploads: [
        {
          resourceToken: 'token-1',
          fileName: 'report.md',
          localPath: 'artifacts/report.md'
        }
      ]
    }
  ]);
  assert.deepEqual(reports[1]?.usage, {
    inputTokens: 13,
    outputTokens: 21
  });

  taskStore.markTaskReported('task-2');

  assert.deepEqual(
    taskStore.getLatestReports().map((report) => report.taskUUID),
    ['task-1']
  );
});

test('TaskStoreService reloads files and reschedules running tasks as queued', async () => {
  const removedDirectories: string[] = [];
  const taskStore = new TaskStoreFileService(
    {
      workingRoot: '/tmp/agent-client',
      maxConcurrency: 2
    },
    {
      mkdir: async () => undefined,
      readdir: async () => ['task-1.json', 'task-2.json'],
      readFile: async (filePath) => {
        if (String(filePath).endsWith('task-1.json')) {
          return JSON.stringify({
            task: createTask('task-1'),
            status: 'running',
            logs: '[task-run] started',
            executeResult: '',
            startedAt: '2025-01-01T00:00:00.000Z',
            finishedAt: null,
            updatedAt: '2025-01-01T00:00:01.000Z'
          });
        }

        return JSON.stringify({
          task: createTask('task-2'),
          status: 'queued',
          logs: '',
          executeResult: '',
          startedAt: null,
          finishedAt: null,
          updatedAt: '2025-01-01T00:00:02.000Z'
        });
      },
      writeFile: async () => undefined,
      removeDirectory: async (targetPath) => {
        removedDirectories.push(targetPath);
      },
      now: () => '2025-01-01T00:00:03.000Z'
    }
  );

  await taskStore.reload();

  const runnableTasks = taskStore.listRunnableTasks();
  const reports = taskStore.getLatestReports();

  assert.deepEqual(
    runnableTasks.map((task) => task.taskUUID),
    ['task-1', 'task-2']
  );
  assert.deepEqual(
    reports.map((report) => report.taskUUID),
    []
  );
  assert.deepEqual(removedDirectories, ['/tmp/agent-client/tasks/task-1']);
  taskStore.updateTaskStatus('task-1', 'running');
  assert.equal(taskStore.getLatestReports()[0]?.taskUUID, 'task-1');
});

test('TaskStoreService defers queued tasks until next attempt time', async () => {
  const taskStore = new TaskStoreFileService(
    {
      workingRoot: '/tmp/agent-client',
      maxConcurrency: 1
    },
    {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      now: () => '2025-01-01T00:00:00.000Z'
    }
  );

  taskStore.insertNewTasks([createTask('task-1')]);
  const deferResult = taskStore.deferTask(
    'task-1',
    '[codex-home] no available home'
  );

  assert.equal(deferResult.retryAfterMs, 5_000);
  assert.deepEqual(taskStore.listRunnableTasks(), []);
  assert.equal(taskStore.getAvailableSlots(), 1);
  assert.equal(taskStore.getAvailableClaimSlots(), 0);
});

test('TaskStoreService removes tasks from memory and file storage', async () => {
  const removedPaths: string[] = [];
  const taskStore = new TaskStoreFileService(
    {
      workingRoot: '/tmp/agent-client',
      maxConcurrency: 1
    },
    {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      removeFile: async (targetPath) => {
        removedPaths.push(targetPath);
      }
    }
  );

  taskStore.insertNewTasks([createTask('task-1')]);
  taskStore.updateTaskStatus('task-1', 'failure', 'failed');
  taskStore.removeTasks(['task-1']);

  assert.deepEqual(taskStore.getLatestReports(), []);
  assert.deepEqual(taskStore.listRunnableTasks(), []);
  assert.deepEqual(removedPaths, ['/tmp/agent-client/task-store/tasks/task-1.json']);
});

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
