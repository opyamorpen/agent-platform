import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { HermesAgentSession } from '../src/agent-session/hermes.ts';
import { AgentSessionExecutionError } from '../src/agent-session/types.ts';

test('HermesAgentSession runs official oneshot CLI without placing a large prompt in spawn arguments', async () => {
  const workspaceRoot = await mkdtemp(
    path.join(os.tmpdir(), 'hermes-session-')
  );
  const executablePath = path.join(workspaceRoot, 'fake-hermes');
  const capturedArgumentsPath = path.join(
    workspaceRoot,
    'captured-arguments.json'
  );
  const skillRoot = path.join(
    workspaceRoot,
    '.agents',
    'skills',
    'review-skill'
  );
  const logs: string[] = [];

  try {
    await createFakeHermesExecutable(executablePath);
    await mkdir(skillRoot, { recursive: true });
    await writeFile(
      path.join(skillRoot, 'SKILL.md'),
      'Use ${HERMES_SKILL_DIR}/references/checklist.md before answering.',
      'utf8'
    );

    const taskPrompt = [
      'fix $(touch should-not-exist) with quotes \' " and newline',
      'x'.repeat(512 * 1024)
    ].join('\n');
    const session = new HermesAgentSession({
      workspaceRoot,
      prompt: taskPrompt,
      env: {
        HERMES_TEST_CAPTURE_ARGS: capturedArgumentsPath
      },
      hermesExecutablePath: executablePath,
      hermesProfile: 'coder',
      hermesProvider: 'deepseek',
      hermesToolsets: 'terminal,filesystem',
      model: 'deepseek-v4-flash'
    });

    const result = await session.execute(({ logs: log }) => {
      logs.push(log);
    });
    const capturedArguments = JSON.parse(
      await readFile(capturedArgumentsPath, 'utf8')
    ) as string[];
    const prompt = capturedArguments[capturedArguments.indexOf('-z') + 1] ?? '';

    assert.equal(result.result, '<outputs><output>ok</output></outputs>');
    assert.deepEqual(result.usage, {
      inputTokens: 101,
      outputTokens: 23
    });
    assert.deepEqual(capturedArguments.slice(0, 2), ['--profile', 'coder']);
    assert.ok(capturedArguments.includes('--usage-file'));
    assert.ok(capturedArguments.includes('deepseek-v4-flash'));
    assert.ok(capturedArguments.includes('deepseek'));
    assert.ok(capturedArguments.includes('terminal,filesystem'));
    assert.ok(prompt.includes(taskPrompt));
    assert.ok(prompt.includes('<task-skill name="review-skill"'));
    assert.ok(prompt.includes(`${skillRoot}/references/checklist.md`));
    assert.equal(
      await readFile(
        path.join(workspaceRoot, 'should-not-exist'),
        'utf8'
      ).catch(() => null),
      null
    );
    assert.ok(logs.includes('[agent-session] hermes session started'));
    assert.ok(logs.includes('[agent-session] hermes session completed'));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('HermesAgentSession returns stderr and usage when Hermes fails', async () => {
  const workspaceRoot = await mkdtemp(
    path.join(os.tmpdir(), 'hermes-session-')
  );
  const executablePath = path.join(workspaceRoot, 'fake-hermes');

  try {
    await createFakeHermesExecutable(executablePath);
    const session = new HermesAgentSession({
      workspaceRoot,
      prompt: 'fail',
      env: {
        HERMES_TEST_MODE: 'fail'
      },
      hermesExecutablePath: executablePath
    });

    await assert.rejects(
      session.execute(() => {}),
      (error: unknown) => {
        assert.ok(error instanceof AgentSessionExecutionError);
        assert.match(
          error.message,
          /hermes exited with code 7: provider failed/
        );
        assert.deepEqual(error.usage, {
          inputTokens: 101,
          outputTokens: 23
        });
        return true;
      }
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('HermesAgentSession terminates a timed out process', async () => {
  const workspaceRoot = await mkdtemp(
    path.join(os.tmpdir(), 'hermes-session-')
  );
  const executablePath = path.join(workspaceRoot, 'fake-hermes');

  try {
    await createFakeHermesExecutable(executablePath);
    const session = new HermesAgentSession({
      workspaceRoot,
      prompt: 'wait',
      env: {
        HERMES_TEST_MODE: 'hang'
      },
      hermesExecutablePath: executablePath,
      timeoutMs: 100
    });

    await assert.rejects(
      session.execute(() => {}),
      /timed out after 100ms/
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

async function createFakeHermesExecutable(filePath: string) {
  await writeFile(
    filePath,
    [
      `#!${process.execPath}`,
      "const fs = require('node:fs');",
      'const args = process.argv.slice(2);',
      "const usageFile = args[args.indexOf('--usage-file') + 1];",
      'fs.writeFileSync(usageFile, JSON.stringify({ input_tokens: 101, output_tokens: 23 }));',
      'if (process.env.HERMES_TEST_CAPTURE_ARGS) fs.writeFileSync(process.env.HERMES_TEST_CAPTURE_ARGS, JSON.stringify(args));',
      "if (process.env.HERMES_TEST_MODE === 'fail') { console.error('provider failed'); process.exit(7); }",
      "if (process.env.HERMES_TEST_MODE === 'hang') setInterval(() => {}, 1000);",
      "else process.stdout.write('<outputs><output>ok</output></outputs>\\n');"
    ].join('\n'),
    'utf8'
  );
  await chmod(filePath, 0o755);
}
