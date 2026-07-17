import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { AgentTokenUsage } from '@ones-ai-workflow/shared';
import { TaskRun } from '../src/task-run/service.ts';
import {
  AgentSession,
  type AgentSessionExecuteResult
} from '../src/agent-session/types.ts';
import type { Skill } from '../src/skill/index.ts';
import type { Workspace } from '../src/workspace/index.ts';

test('TaskRun cleans up workspace after successful execution', async () => {
  const events: string[] = [];
  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-1',
      sourceWorkspaceUUID: 'workspace-1',
      skillUUIDs: ['skill-1'],
      prompt: 'do work'
    },
    createWorkspaceStub(events),
    createSkillStub(events),
    {
      listWorkspaceRepoNames: async () => ['repo-a', 'repo-b'],
      listMountedSkillNames: async () => ['skill-1'],
      createAgentSession: () =>
        new FakeAgentSession(async (onProgress) => {
          events.push('session.execute');
          onProgress({
            logs: '[agent-session] working'
          });
          return {
            result: '<outputs>done</outputs>',
            usage: {
              inputTokens: 11,
              outputTokens: 22
            }
          };
        })
    }
  );

  taskRun.start({
    onProgress: ({ logs }) => {
      events.push(`progress:${logs}`);
    },
    onError: (error) => {
      events.push(`error:${error.message}`);
      resolveCompletion?.();
    },
    onFinish: (result, _attachmentUploads, usage) => {
      events.push(`finish:${result}`);
      assert.deepEqual(usage, {
        inputTokens: 11,
        outputTokens: 22
      });
      resolveCompletion?.();
    }
  });

  await completion;

  assert.deepEqual(events, [
    'progress:[task-run] task uuid: task-1',
    'progress:[task-run] preparing workspace',
    'workspace.prepare',
    'progress:[task-run] workspace repos: repo-a, repo-b',
    'progress:[task-run] mounting skills',
    'skill.mount',
    'progress:[task-run] mounted skills: skill-1',
    'progress:[task-run] injected workspace secrets: (none)',
    'progress:[task-run] executing agent session',
    'session.execute',
    'progress:[agent-session] working',
    'progress:[task-run] attachment output paths: (none)',
    'progress:[task-run] cleaning up workspace',
    'workspace.cleanup',
    'finish:<outputs>done</outputs>'
  ]);
});

test('TaskRun passes agent options into createAgentSession', async () => {
  let capturedExecuteAgentType: string | undefined;
  let capturedInput:
    | {
        prompt: string;
        env?: Record<string, string>;
        codexApiKey?: string;
        codexBaseUrl?: string;
        hermesExecutablePath?: string;
        hermesProfile?: string;
        hermesProvider?: string;
        hermesToolsets?: string;
        model?: string;
        modelReasoningEffort?: string;
      }
    | undefined;
  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-agent-type',
      sourceWorkspaceUUID: null,
      skillUUIDs: [],
      prompt: 'run with claude',
      executeAgentType: 'claude',
      codexApiKey: 'agent-client-key',
      codexBaseUrl: 'https://api.openai.com/v1',
      hermesExecutablePath: '/usr/local/bin/hermes',
      hermesProfile: 'coder',
      hermesProvider: 'deepseek',
      hermesToolsets: 'terminal,filesystem',
      model: 'gpt-5.4',
      modelReasoningEffort: 'high'
    },
    createWorkspaceStub([]),
    createSkillStub([]),
    {
      listWorkspaceRepoNames: async () => [],
      listMountedSkillNames: async () => [],
      fetchTaskRuntimeEnv: async () => ({
        env: {
          OPENAI_API_KEY: 'secret-token'
        }
      }),
      createAgentSession: (_input, executeAgentType) => {
        capturedExecuteAgentType = executeAgentType;
        capturedInput = _input;
        return new FakeAgentSession(async () => '<outputs>done</outputs>');
      }
    }
  );

  taskRun.start({
    onProgress() {},
    onError(error) {
      throw error;
    },
    onFinish() {
      resolveCompletion?.();
    }
  });

  await completion;

  assert.equal(capturedExecuteAgentType, 'claude');
  assert.equal(capturedInput?.prompt, 'run with claude');
  assert.deepEqual(capturedInput?.env, {
    GIT_SSH_COMMAND: "ssh -i '/tmp/workspace/.ssh/id_ed25519' -o IdentitiesOnly=yes",
    OPENAI_API_KEY: 'secret-token'
  });
  assert.equal(capturedInput?.codexApiKey, 'agent-client-key');
  assert.equal(capturedInput?.codexBaseUrl, 'https://api.openai.com/v1');
  assert.equal(capturedInput?.hermesExecutablePath, '/usr/local/bin/hermes');
  assert.equal(capturedInput?.hermesProfile, 'coder');
  assert.equal(capturedInput?.hermesProvider, 'deepseek');
  assert.equal(capturedInput?.hermesToolsets, 'terminal,filesystem');
  assert.equal(capturedInput?.model, 'gpt-5.4');
  assert.equal(capturedInput?.modelReasoningEffort, 'high');
});

test('TaskRun uploads attachment outputs before cleanup', async () => {
  const events: string[] = [];
  const uploads: Array<{
    taskUUID: string;
    files: { localPath: string; fileName: string; bytes: Uint8Array }[];
  }> = [];
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'task-run-'));
  const reportPath = path.join(workspaceRoot, 'artifacts', 'report.md');
  const screenshotPath = path.join(workspaceRoot, 'artifacts', 'screenshot.png');
  await mkdir(path.join(workspaceRoot, 'artifacts'), { recursive: true });
  await writeFile(reportPath, 'report body', 'utf8');
  await writeFile(screenshotPath, 'png-bytes', 'utf8');

  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-attachments',
      sourceWorkspaceUUID: null,
      skillUUIDs: [],
      prompt: 'attach files',
      executeOption: {
        outputPaths: ['field001'],
        attachmentOutputPaths: ['field001']
      }
    },
    createWorkspaceStub(events, {
      async prepareWorkspace() {
        events.push('workspace.prepare');
        return {
          workspaceRoot,
          gitEnv: {}
        };
      },
      async cleanupTaskWorkspace() {
        events.push('workspace.cleanup');
      }
    }),
    createSkillStub(events),
    {
      listWorkspaceRepoNames: async () => ['repo-a'],
      listMountedSkillNames: async () => [],
      createAgentSession: () =>
        new FakeAgentSession(async () => {
          events.push('session.execute');
          return [
            '<outputs>',
            '  <output>',
            '    <field-uuid>field001</field-uuid>',
            '    <objects>',
            '      <object>',
            '        <object-write-mode>create</object-write-mode>',
            '        <object-type>attachment</object-type>',
            '        <fields>',
            '          <field>',
            '            <field-uuid>local_path</field-uuid>',
            '            <set-value>artifacts/report.md</set-value>',
            '          </field>',
            '        </fields>',
            '      </object>',
            '      <object>',
            '        <object-write-mode>create</object-write-mode>',
            '        <object-type>attachment</object-type>',
            '        <fields>',
            '          <field>',
            '            <field-uuid>local_path</field-uuid>',
            '            <set-value>artifacts/screenshot.png</set-value>',
            '          </field>',
            '        </fields>',
            '      </object>',
            '    </objects>',
            '  </output>',
            '</outputs>'
          ].join('\n');
        }),
      uploadTaskAttachments: async (taskUUID, files) => {
        uploads.push({ taskUUID, files });
        return {
          uploads: files.map((file, index) => ({
            resourceToken: `token-${index + 1}`,
            fileName: file.fileName,
            localPath: file.localPath
          }))
        };
      }
    }
  );

  taskRun.start({
    onProgress: ({ logs }) => {
      events.push(`progress:${logs}`);
    },
    onError: (error) => {
      events.push(`error:${error.message}`);
      resolveCompletion?.();
    },
    onFinish: (result, attachmentUploads) => {
      events.push(`finish:${result}`);
      assert.deepEqual(attachmentUploads, [
        {
          outputName: 'field001',
          uploads: [
            {
              resourceToken: 'token-1',
              fileName: 'report.md',
              localPath: 'artifacts/report.md'
            },
            {
              resourceToken: 'token-2',
              fileName: 'screenshot.png',
              localPath: 'artifacts/screenshot.png'
            }
          ]
        }
      ]);
      resolveCompletion?.();
    }
  });

  await completion;
  await rm(workspaceRoot, { recursive: true, force: true });

  assert.equal(uploads.length, 1);
  assert.equal(uploads[0]?.taskUUID, 'task-attachments');
  assert.deepEqual(
    uploads[0]?.files.map((file) => ({
      localPath: file.localPath,
      fileName: file.fileName
    })),
    [
      {
        localPath: 'artifacts/report.md',
        fileName: 'report.md'
      },
      {
        localPath: 'artifacts/screenshot.png',
        fileName: 'screenshot.png'
      }
    ]
  );
  assert.deepEqual(events, [
    'progress:[task-run] task uuid: task-attachments',
    'progress:[task-run] preparing workspace',
    'workspace.prepare',
    'progress:[task-run] workspace repos: repo-a',
    'progress:[task-run] mounting skills',
    'skill.mount',
    'progress:[task-run] mounted skills: (none)',
    'progress:[task-run] injected workspace secrets: (none)',
    'progress:[task-run] executing agent session',
    'session.execute',
    'progress:[task-run] attachment output paths: field001',
    'progress:[task-run] uploading 2 attachment(s) for output "field001"',
    'progress:[task-run] cleaning up workspace',
    'workspace.cleanup',
    'finish:<outputs>\n  <output>\n    <field-uuid>field001</field-uuid>\n    <objects>\n      <object>\n        <object-write-mode>create</object-write-mode>\n        <object-type>attachment</object-type>\n        <fields>\n          <field>\n            <field-uuid>local_path</field-uuid>\n            <set-value>artifacts/report.md</set-value>\n          </field>\n        </fields>\n      </object>\n      <object>\n        <object-write-mode>create</object-write-mode>\n        <object-type>attachment</object-type>\n        <fields>\n          <field>\n            <field-uuid>local_path</field-uuid>\n            <set-value>artifacts/screenshot.png</set-value>\n          </field>\n        </fields>\n      </object>\n    </objects>\n  </output>\n</outputs>'
  ]);
});

test('TaskRun uploads nested issue attachment outputs before cleanup', async () => {
  const uploads: Array<{
    taskUUID: string;
    files: { localPath: string; fileName: string; bytes: Uint8Array }[];
  }> = [];
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'task-run-nested-'));
  const reportPath = path.join(workspaceRoot, 'artifacts', 'report.md');
  await mkdir(path.join(workspaceRoot, 'artifacts'), { recursive: true });
  await writeFile(reportPath, 'report body', 'utf8');

  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-nested-attachments',
      sourceWorkspaceUUID: null,
      skillUUIDs: [],
      prompt: 'attach nested files',
      executeOption: {
        outputPaths: ['field200'],
        attachmentOutputPaths: ['field200.field047']
      }
    },
    createWorkspaceStub([], {
      async prepareWorkspace() {
        return {
          workspaceRoot,
          gitEnv: {}
        };
      }
    }),
    createSkillStub([]),
    {
      listWorkspaceRepoNames: async () => [],
      listMountedSkillNames: async () => [],
      createAgentSession: () =>
        new FakeAgentSession(async () =>
          [
            '<outputs>',
            '  <output>',
            '    <field-uuid>field200</field-uuid>',
            '    <objects>',
            '      <object>',
            '        <object-write-mode>create</object-write-mode>',
            '        <object-type>issue</object-type>',
            '        <fields>',
            '          <field>',
            '            <field-uuid>field047</field-uuid>',
            '            <objects>',
            '              <object>',
            '                <object-write-mode>create</object-write-mode>',
            '                <object-type>attachment</object-type>',
            '                <fields>',
            '                  <field>',
            '                    <field-uuid>local_path</field-uuid>',
            '                    <set-value>artifacts/report.md</set-value>',
            '                  </field>',
            '                </fields>',
            '              </object>',
            '            </objects>',
            '          </field>',
            '        </fields>',
            '      </object>',
            '    </objects>',
            '  </output>',
            '</outputs>'
          ].join('\n')
        ),
      uploadTaskAttachments: async (taskUUID, files) => {
        uploads.push({ taskUUID, files });
        return {
          uploads: files.map((file, index) => ({
            resourceToken: `nested-token-${index + 1}`,
            fileName: file.fileName,
            localPath: file.localPath
          }))
        };
      }
    }
  );

  taskRun.start({
    onProgress() {},
    onError(error) {
      throw error;
    },
    onFinish(_result, attachmentUploads) {
      assert.deepEqual(attachmentUploads, [
        {
          outputName: 'field200.field047',
          uploads: [
            {
              resourceToken: 'nested-token-1',
              fileName: 'report.md',
              localPath: 'artifacts/report.md'
            }
          ]
        }
      ]);
      resolveCompletion?.();
    }
  });

  await completion;
  await rm(workspaceRoot, { recursive: true, force: true });

  assert.equal(uploads.length, 1);
  assert.equal(uploads[0]?.taskUUID, 'task-nested-attachments');
  assert.deepEqual(
    uploads[0]?.files.map((file) => ({
      localPath: file.localPath,
      fileName: file.fileName
    })),
    [
      {
        localPath: 'artifacts/report.md',
        fileName: 'report.md'
      }
    ]
  );
});

test('TaskRun still cleans up workspace when execution fails', async () => {
  const events: string[] = [];
  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-2',
      sourceWorkspaceUUID: null,
      skillUUIDs: [],
      prompt: 'fail'
    },
    createWorkspaceStub(events),
    createSkillStub(events),
    {
      listWorkspaceRepoNames: async () => ['repo-a'],
      listMountedSkillNames: async () => [],
      createAgentSession: () =>
        new FakeAgentSession(async () => {
          events.push('session.execute');
          throw new Error('execute failed');
        })
    }
  );

  taskRun.start({
    onProgress: ({ logs }) => {
      events.push(`progress:${logs}`);
    },
    onError: (error) => {
      events.push(`error:${error.message}`);
      resolveCompletion?.();
    },
    onFinish: (result) => {
      events.push(`finish:${result}`);
      resolveCompletion?.();
    }
  });

  await completion;

  assert.deepEqual(events, [
    'progress:[task-run] task uuid: task-2',
    'progress:[task-run] preparing workspace',
    'workspace.prepare',
    'progress:[task-run] workspace repos: repo-a',
    'progress:[task-run] mounting skills',
    'skill.mount',
    'progress:[task-run] mounted skills: (none)',
    'progress:[task-run] injected workspace secrets: (none)',
    'progress:[task-run] executing agent session',
    'session.execute',
    'progress:[task-run] cleaning up workspace',
    'workspace.cleanup',
    'error:execute failed'
  ]);
});

test('TaskRun reports cleanup failure as task error', async () => {
  const events: string[] = [];
  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-3',
      sourceWorkspaceUUID: null,
      skillUUIDs: [],
      prompt: 'cleanup failure'
    },
    createWorkspaceStub(events, {
      cleanupTaskWorkspace: async () => {
        events.push('workspace.cleanup');
        throw new Error('cleanup exploded');
      }
    }),
    createSkillStub(events),
    {
      listWorkspaceRepoNames: async () => [],
      listMountedSkillNames: async () => [],
      createAgentSession: () =>
        new FakeAgentSession(async () => {
          events.push('session.execute');
          return '<outputs>done</outputs>';
        })
    }
  );

  taskRun.start({
    onProgress: ({ logs }) => {
      events.push(`progress:${logs}`);
    },
    onError: (error) => {
      events.push(`error:${error.message}`);
      resolveCompletion?.();
    },
    onFinish: (result) => {
      events.push(`finish:${result}`);
      resolveCompletion?.();
    }
  });

  await completion;

  assert.deepEqual(events, [
    'progress:[task-run] task uuid: task-3',
    'progress:[task-run] preparing workspace',
    'workspace.prepare',
    'progress:[task-run] workspace repos: (none)',
    'progress:[task-run] mounting skills',
    'skill.mount',
    'progress:[task-run] mounted skills: (none)',
    'progress:[task-run] injected workspace secrets: (none)',
    'progress:[task-run] executing agent session',
    'session.execute',
    'progress:[task-run] attachment output paths: (none)',
    'progress:[task-run] cleaning up workspace',
    'workspace.cleanup',
    'error:[task-run] cleanup failed: cleanup exploded'
  ]);
});

test('TaskRun logs injected workspace secret keys without values', async () => {
  const events: string[] = [];
  let resolveCompletion: (() => void) | null = null;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const taskRun = new TaskRun(
    {
      taskUUID: 'task-secret-keys',
      sourceWorkspaceUUID: null,
      skillUUIDs: [],
      prompt: 'use the secrets'
    },
    createWorkspaceStub(events),
    createSkillStub(events),
    {
      listWorkspaceRepoNames: async () => [],
      listMountedSkillNames: async () => [],
      fetchTaskRuntimeEnv: async () => ({
        env: {
          GITHUB_TOKEN: 'github-token-value',
          OPENAI_API_KEY: 'openai-token-value'
        }
      }),
      createAgentSession: () =>
        new FakeAgentSession(async () => '<outputs>done</outputs>')
    }
  );

  taskRun.start({
    onProgress: ({ logs }) => {
      events.push(`progress:${logs}`);
    },
    onError(error) {
      throw error;
    },
    onFinish() {
      resolveCompletion?.();
    }
  });

  await completion;

  assert.ok(
    events.includes(
      'progress:[task-run] injected workspace secrets: GITHUB_TOKEN, OPENAI_API_KEY'
    )
  );
  assert.ok(!events.some((event) => event.includes('github-token-value')));
  assert.ok(!events.some((event) => event.includes('openai-token-value')));
});

function createWorkspaceStub(
  events: string[],
  overrides: Partial<Workspace> = {}
): Workspace {
  return {
    async ensureSourceWorkspace() {},
    async prepareWorkspace() {
      events.push('workspace.prepare');
      return {
        workspaceRoot: '/tmp/workspace',
        gitEnv: {
          GIT_SSH_COMMAND: "ssh -i '/tmp/workspace/.ssh/id_ed25519' -o IdentitiesOnly=yes"
        }
      };
    },
    async cleanupTaskWorkspace() {
      events.push('workspace.cleanup');
    },
    ...overrides
  };
}

function createSkillStub(
  events: string[],
  overrides: Partial<Skill> = {}
): Skill {
  return {
    async ensureSkills() {},
    async mountSkills() {
      events.push('skill.mount');
    },
    ...overrides
  };
}

class FakeAgentSession extends AgentSession {
  constructor(
    private readonly executeImplementation: (
      onProgress: (info: { logs: string }) => void
    ) => Promise<string | AgentSessionExecuteResult>
  ) {
    super({
      workspaceRoot: '/tmp/workspace',
      prompt: 'prompt'
    });
  }

  execute(
    onProgress: (info: { logs: string }) => void
  ): Promise<AgentSessionExecuteResult> {
    return this.executeImplementation(onProgress).then((result) =>
      typeof result === 'string'
        ? {
            result,
            usage: null
          }
        : {
            result: result.result,
            usage: normalizeUsage(result.usage)
          }
    );
  }

  abort(): Promise<void> {
    return Promise.resolve();
  }
}

function normalizeUsage(usage: AgentTokenUsage | null | undefined): AgentTokenUsage | null {
  return usage ?? null;
}
