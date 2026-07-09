import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { HermesAgentSession } from '../src/agent-session/hermes.ts';

test('HermesAgentSession executes command template with prompt file', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'hermes-session-'));
  const logs: string[] = [];

  try {
    const session = new HermesAgentSession({
      workspaceRoot,
      prompt: '<input>hello hermes</input>',
      hermesCommandTemplate:
        'node -e "const fs=require(\\"fs\\"); const prompt=fs.readFileSync(process.argv[1],\\"utf8\\"); console.log(\\"<outputs>\\" + prompt + \\"</outputs>\\");" {promptFile}'
    });

    const result = await session.execute(({ logs: log }) => {
      logs.push(log);
    });

    assert.equal(result.result, '<outputs><input>hello hermes</input></outputs>');
    assert.equal(result.usage, null);
    assert.ok(logs.includes('[agent-session] hermes session started'));
    assert.ok(logs.includes('[agent-session] hermes session completed'));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
