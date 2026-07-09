import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CodexAgentSession } from '../src/agent-session/codex.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const e2eRoot = path.join(workspaceRoot, '.agent-client', 'e2e');

test(
  'CodexAgentSession returns the expected <outputs> block with real codex',
  { timeout: 120_000 },
  async () => {
    const expectedToken = `E2E_OUTPUTS_${Date.now()}`;
    const logs: string[] = [];
    const session = new CodexAgentSession({
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
      logs.some((log) => log.startsWith('[agent-session] thread started:')),
      `expected thread started log, got: ${logs.join('\n')}`
    );
    assert.ok(
      logs.includes('[agent-session] codex session completed'),
      `expected session completed log, got: ${logs.join('\n')}`
    );
  }
);

test(
  'CodexAgentSession can trigger a real command and produce the expected file',
  { timeout: 120_000 },
  async () => {
    const expectedToken = `E2E_TOOL_${Date.now()}`;
    const relativeDir = path.join('.agent-client', 'e2e', expectedToken);
    const relativeFilePath = path.join(relativeDir, 'result.txt');
    const absoluteDir = path.join(workspaceRoot, relativeDir);
    const absoluteFilePath = path.join(workspaceRoot, relativeFilePath);

    await rm(absoluteDir, { recursive: true, force: true });
    await mkdir(absoluteDir, { recursive: true });

    const logs: string[] = [];
    const session = new CodexAgentSession({
      workspaceRoot,
      prompt: [
        'Use a shell command to create the file below with the exact token as its only content.',
        `File path: ${relativeFilePath}`,
        `Token: ${expectedToken}`,
        `After writing the file, reply with exactly <outputs>${expectedToken}</outputs>.`
      ].join('\n'),
      timeoutMs: 90_000
    });

    try {
      const finalResponse = await session.execute((info) => {
        logs.push(info.logs);
      });

      const fileContent = await readFile(absoluteFilePath, 'utf8');

      assert.match(
        finalResponse,
        new RegExp(`<outputs>${expectedToken}</outputs>`)
      );
      assert.equal(fileContent.trim(), expectedToken);
      assert.ok(
        logs.some((log) => log.startsWith('[agent-session] command started:')),
        `expected command log, got: ${logs.join('\n')}`
      );
      assert.ok(
        logs.includes('[agent-session] codex session completed'),
        `expected session completed log, got: ${logs.join('\n')}`
      );
    } finally {
      await rm(absoluteDir, { recursive: true, force: true });
    }
  }
);
