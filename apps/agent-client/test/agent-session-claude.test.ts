import assert from 'node:assert/strict';
import test from 'node:test';
import * as ClaudeAgentSdk from '@anthropic-ai/claude-agent-sdk';
import {
  ClaudeAgentSession,
  setClaudeQueryImplementationForTest
} from '../src/agent-session/claude.ts';

test('ClaudeAgentSession returns the SDK result and reports session progress', async () => {
  setClaudeQueryImplementationForTest((params) => {
    assert.equal(params.prompt, 'fix this');
    assert.deepEqual(params.options, {
      abortController: params.options?.abortController,
      cwd: '/tmp/workspace',
      model: 'sonnet',
      pathToClaudeCodeExecutable: 'claude',
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      tools: {
        type: 'preset',
        preset: 'claude_code'
      }
    });

    return createQuery([
      {
        type: 'system',
        subtype: 'init',
        session_id: 'session-1'
      },
      {
        type: 'assistant',
        session_id: 'session-1',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: {
                command: 'pwd'
              }
            }
          ]
        }
      },
      {
        type: 'result',
        subtype: 'success',
        result: '<outputs>done</outputs>',
        session_id: 'session-1',
        usage: {
          input_tokens: 12,
          output_tokens: 34
        }
      }
    ]);
  });

  const logs: string[] = [];
  const session = new ClaudeAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'fix this',
    model: 'sonnet'
  });

  const execution = await session.execute((info) => {
    logs.push(info.logs);
  });

  assert.equal(execution.result, '<outputs>done</outputs>');
  assert.deepEqual(execution.usage, {
    inputTokens: 12,
    outputTokens: 34
  });
  assert.ok(logs.includes('[agent-session] claude session started'));
  assert.ok(logs.includes('[agent-session] claude session initialized: session-1'));
  assert.ok(logs.includes('[agent-session] command started: pwd'));
  assert.ok(logs.includes('[agent-session] claude session completed'));
  setClaudeQueryImplementationForTest(null);
});

test('ClaudeAgentSession surfaces SDK result errors', async () => {
  setClaudeQueryImplementationForTest(() => {
    return createQuery([
      {
        type: 'result',
        subtype: 'error_during_execution',
        errors: ['tool failed', 'permission denied'],
        session_id: 'session-2',
        usage: {
          input_tokens: 5,
          output_tokens: 7
        }
      }
    ]);
  });

  const logs: string[] = [];
  const session = new ClaudeAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'break'
  });

  await assert.rejects(
    () =>
      session.execute((info) => {
        logs.push(info.logs);
      }),
    /tool failed\npermission denied/
  );

  assert.ok(
    logs.includes(
      '[agent-session] claude session failed: tool failed\npermission denied'
    )
  );
  setClaudeQueryImplementationForTest(null);
});

test('ClaudeAgentSession aborts when timeout is reached', async () => {
  let closeCallCount = 0;
  setClaudeQueryImplementationForTest(() => {
    return createAbortAwareQuery(() => {
      closeCallCount += 1;
    });
  });

  const logs: string[] = [];
  const session = new ClaudeAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'wait',
    timeoutMs: 20
  });

  await assert.rejects(
    () =>
      session.execute((info) => {
        logs.push(info.logs);
      }),
    /timed out after 20ms/
  );

  assert.ok(
    logs.includes('[agent-session] claude session failed: timed out after 20ms')
  );
  assert.ok(closeCallCount >= 1);
  setClaudeQueryImplementationForTest(null);
});

test('ClaudeAgentSession forwards custom environment variables to the SDK', async () => {
  setClaudeQueryImplementationForTest((params) => {
    assert.equal(
      params.options?.env?.GIT_SSH_COMMAND,
      "ssh -i '/tmp/workspace/.ssh/id_ed25519' -o IdentitiesOnly=yes"
    );

    return createQuery([
      {
        type: 'result',
        subtype: 'success',
        result: '<outputs>done</outputs>',
        session_id: 'session-3'
      }
    ]);
  });

  const session = new ClaudeAgentSession({
    workspaceRoot: '/tmp/workspace',
    prompt: 'env please',
    env: {
      GIT_SSH_COMMAND:
        "ssh -i '/tmp/workspace/.ssh/id_ed25519' -o IdentitiesOnly=yes"
    }
  });

  const execution = await session.execute(() => {});

  assert.equal(execution.result, '<outputs>done</outputs>');
  setClaudeQueryImplementationForTest(null);
});

function createQuery(messages: unknown[]): ClaudeAgentSdk.Query {
  const iterator = (async function* stream() {
    for (const message of messages) {
      yield message as never;
    }
  })();

  return Object.assign(iterator, {
    close() {}
  }) as ClaudeAgentSdk.Query;
}

function createAbortAwareQuery(onClose: () => void): ClaudeAgentSdk.Query {
  let closed = false;

  const iterator = (async function* stream() {
    try {
      yield {
        type: 'system',
        subtype: 'init',
        session_id: 'session-timeout'
      } as never;

      await new Promise<void>((resolve) => {
        const poll = () => {
          if (closed) {
            resolve();
            return;
          }

          setTimeout(poll, 5);
        };

        poll();
      });

      throw new Error('aborted');
    } finally {
      onClose();
    }
  })();

  return Object.assign(iterator, {
    close() {
      closed = true;
    }
  }) as ClaudeAgentSdk.Query;
}
