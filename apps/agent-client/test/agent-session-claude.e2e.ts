import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ClaudeAgentSession } from '../src/agent-session/claude.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');

test(
  'ClaudeAgentSession returns the expected <outputs> block with real claude',
  { timeout: 120_000 },
  async () => {
    const expectedToken = `CLAUDE_E2E_OUTPUTS_${Date.now()}`;
    const logs: string[] = [];
    const session = new ClaudeAgentSession({
      workspaceRoot,
      prompt: [
        'Reply with exactly one XML block and nothing else.',
        `Return: <outputs>${expectedToken}</outputs>`,
        'Do not use tools.',
        expectedToken
      ].join('\n'),
      timeoutMs: 90_000
    });

    const finalResponse = await session.execute((info) => {
      logs.push(info.logs);
    });

    assert.equal(finalResponse.trim(), `<outputs>${expectedToken}</outputs>`);
    assert.ok(
      logs.some((log) =>
        log.startsWith('[agent-session] claude session initialized:')
      ),
      `expected init log, got: ${logs.join('\n')}`
    );
    assert.ok(
      logs.includes('[agent-session] claude session completed'),
      `expected session completed log, got: ${logs.join('\n')}`
    );
  }
);
