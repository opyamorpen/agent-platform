import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { Codex } from '@openai/codex-sdk';
import { CodexAgentSession } from '../src/agent-session/codex.ts';

test('CodexAgentSession returns concatenated agent messages and reports progress logs', async () => {
  const startThreadMock = mock.method(Codex.prototype, 'startThread', () => {
    return {
      runStreamed: async () => ({
        events: createEventStream([
          { type: 'thread.started', thread_id: 'thread-1' },
          { type: 'turn.started' },
          {
            type: 'item.started',
            item: {
              id: 'cmd-1',
              type: 'command_execution',
              command: 'pwd',
              aggregated_output: '',
              status: 'in_progress'
            }
          },
          {
            type: 'item.updated',
            item: {
              id: 'cmd-1',
              type: 'command_execution',
              command: 'pwd',
              aggregated_output: '/tmp',
              status: 'in_progress'
            }
          },
          {
            type: 'item.completed',
            item: {
              id: 'cmd-1',
              type: 'command_execution',
              command: 'pwd',
              aggregated_output: '/tmp/workspace',
              exit_code: 0,
              status: 'completed'
            }
          },
          {
            type: 'item.updated',
            item: {
              id: 'msg-1',
              type: 'agent_message',
              text: 'First'
            }
          },
          {
            type: 'item.updated',
            item: {
              id: 'msg-1',
              type: 'agent_message',
              text: 'First answer'
            }
          },
          {
            type: 'item.completed',
            item: {
              id: 'msg-1',
              type: 'agent_message',
              text: 'First answer'
            }
          },
          {
            type: 'item.completed',
            item: {
              id: 'msg-2',
              type: 'agent_message',
              text: '<outputs>Second answer</outputs>'
            }
          },
          {
            type: 'item.completed',
            item: {
              id: 'reason-1',
              type: 'reasoning',
              text: 'hidden reasoning'
            }
          },
          {
            type: 'turn.completed',
            usage: {
              input_tokens: 1,
              cached_input_tokens: 0,
              output_tokens: 2,
              reasoning_output_tokens: 0
            }
          }
        ])
      })
    };
  });

  const logs: string[] = [];
  const session = new CodexAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'say hi',
    model: 'gpt-5.4',
    modelReasoningEffort: 'high'
  });

  await assert.doesNotReject(async () => {
    const execution = await session.execute((info) => {
      logs.push(info.logs);
    });

    assert.equal(
      execution.result,
      ['First answer', '<outputs>Second answer</outputs>'].join('\n\n')
    );
    assert.deepEqual(execution.usage, {
      inputTokens: 1,
      outputTokens: 2
    });
  });

  assert.equal(startThreadMock.mock.callCount(), 1);
  assert.deepEqual(startThreadMock.mock.calls[0]?.arguments, [
    {
      model: 'gpt-5.4',
      modelReasoningEffort: 'high',
      workingDirectory: '/tmp/workspace',
      skipGitRepoCheck: true,
      sandboxMode: 'danger-full-access',
      approvalPolicy: 'never'
    }
  ]);
  assert.ok(logs.includes('[agent-session] codex session started'));
  assert.ok(logs.includes('[agent-session] thread started: thread-1'));
  assert.ok(logs.includes('[agent-session] command started: pwd'));
  assert.ok(!logs.some((log) => log.startsWith('[agent-session] command output:')));
  assert.ok(logs.includes('[agent-session] agent message:\nFirst'));
  assert.ok(logs.includes('[agent-session] agent message:\nanswer'));
  assert.ok(logs.includes('[agent-session] command completed: pwd (exit 0)'));
  assert.ok(logs.includes('[agent-session] agent response completed'));
  assert.ok(logs.includes('[agent-session] turn completed'));
  assert.ok(logs.includes('[agent-session] codex session completed'));

  startThreadMock.mock.restore();
});

test('CodexAgentSession passes API key and base URL to Codex SDK', async () => {
  let capturedOptions: {
    apiKey?: string;
    baseUrl?: string;
    env?: Record<string, string>;
  } | null = null;

  const startThreadMock = mock.method(Codex.prototype, 'startThread', function (
    this: { options?: typeof capturedOptions }
  ) {
    capturedOptions = this.options ?? null;

    return {
      runStreamed: async () => ({
        events: createEventStream([
          {
            type: 'item.completed',
            item: {
              id: 'msg-1',
              type: 'agent_message',
              text: '<outputs>done</outputs>'
            }
          },
          {
            type: 'turn.completed',
            usage: {
              input_tokens: 1,
              cached_input_tokens: 0,
              output_tokens: 1,
              reasoning_output_tokens: 0
            }
          }
        ])
      })
    };
  });

  const session = new CodexAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'say hi',
    env: {
      CODEX_API_KEY: 'runtime-env-key'
    },
    codexApiKey: 'agent-client-key',
    codexBaseUrl: 'https://api.openai.com/v1'
  });

  await session.execute(() => {});

  assert.equal(capturedOptions?.apiKey, 'agent-client-key');
  assert.equal(capturedOptions?.baseUrl, 'https://api.openai.com/v1');
  assert.equal(capturedOptions?.env?.CODEX_API_KEY, 'agent-client-key');

  startThreadMock.mock.restore();
});

test('CodexAgentSession surfaces turn failure as execute error', async () => {
  const startThreadMock = mock.method(Codex.prototype, 'startThread', () => {
    return {
      runStreamed: async () => ({
        events: createEventStream([
          { type: 'thread.started', thread_id: 'thread-2' },
          { type: 'turn.started' },
          {
            type: 'turn.failed',
            error: {
              message: 'tool call failed'
            }
          }
        ])
      })
    };
  });

  const logs: string[] = [];
  const session = new CodexAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'fail please'
  });

  await assert.rejects(
    () =>
      session.execute((info) => {
        logs.push(info.logs);
      }),
    /tool call failed/
  );

  assert.ok(logs.includes('[agent-session] codex session failed: tool call failed'));

  startThreadMock.mock.restore();
});

test('CodexAgentSession aborts when timeout is reached', async () => {
  const startThreadMock = mock.method(Codex.prototype, 'startThread', () => {
    return {
      runStreamed: async (
        _input: string,
        options?: { signal?: AbortSignal }
      ) => ({
        events: createAbortAwareEventStream(options?.signal)
      })
    };
  });

  const logs: string[] = [];
  const session = new CodexAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'wait forever',
    timeoutMs: 20
  });

  await assert.rejects(
    () =>
      session.execute((info) => {
        logs.push(info.logs);
      }),
    /timed out after 20ms/
  );

  assert.ok(logs.includes('[agent-session] codex session failed: timed out after 20ms'));

  startThreadMock.mock.restore();
});

function createEventStream(events: unknown[]): AsyncGenerator<unknown> {
  return (async function* stream() {
    for (const event of events) {
      yield event;
    }
  })();
}

function createAbortAwareEventStream(
  signal?: AbortSignal
): AsyncGenerator<unknown> {
  return (async function* stream() {
    yield { type: 'thread.started', thread_id: 'thread-timeout' };

    await waitForAbort(signal);

    throw new Error('aborted by signal');
  })();
}

function waitForAbort(signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise(() => {});
  }

  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}
