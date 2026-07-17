import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentTokenUsage } from '@ones-ai-workflow/shared';
import {
  AgentSession,
  AgentSessionExecutionError,
  type AgentSessionExecuteResult
} from './types.js';

const HERMES_TERMINATE_GRACE_MS = 2_000;
const HERMES_PROMPT_ARGUMENT_MARKER = '__ONES_HERMES_PROMPT_FROM_FILE__';
const HERMES_DIRECT_PROMPT_LIMIT_BYTES = 64 * 1024;

export class HermesAgentSession extends AgentSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private forceKillHandle: NodeJS.Timeout | null = null;
  private timeoutTriggered = false;
  private abortRequested = false;

  async execute(
    onProgress: (info: { logs: string }) => void
  ): Promise<AgentSessionExecuteResult> {
    const runtimeDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'ones-agent-client-hermes-')
    );
    const usageFile = path.join(runtimeDirectory, 'usage.json');
    const promptFile = path.join(runtimeDirectory, 'prompt.md');
    let usage: AgentTokenUsage | null = null;

    onProgress({
      logs: '[agent-session] hermes session started'
    });

    try {
      const prompt = await buildHermesPrompt(
        this.input.workspaceRoot,
        this.input.prompt
      );
      await writeFile(promptFile, prompt, { encoding: 'utf8', mode: 0o600 });
      this.startTimeout();
      const commandResult = await this.runHermes(
        promptFile,
        usageFile,
        runtimeDirectory,
        onProgress
      );
      usage = await readHermesUsage(usageFile);

      if (this.timeoutTriggered) {
        throw new AgentSessionExecutionError(
          `timed out after ${this.input.timeoutMs}ms`,
          usage
        );
      }

      if (this.abortRequested) {
        throw new AgentSessionExecutionError('aborted', usage);
      }

      if (commandResult.code !== 0) {
        const detail =
          commandResult.stderr.trim() ||
          commandResult.stdout.trim() ||
          commandResult.signal ||
          'unknown error';
        throw new AgentSessionExecutionError(
          `hermes exited with code ${commandResult.code}: ${detail}`,
          usage
        );
      }

      const result = commandResult.stdout.trim();
      if (!result) {
        throw new AgentSessionExecutionError(
          'hermes completed without a final response',
          usage
        );
      }

      onProgress({
        logs: '[agent-session] hermes session completed'
      });

      return {
        result,
        usage
      };
    } catch (error) {
      usage ??= await readHermesUsage(usageFile);
      const normalizedError = normalizeHermesError(error, usage);

      onProgress({
        logs: `[agent-session] hermes session failed: ${normalizedError.message}`
      });

      throw normalizedError;
    } finally {
      this.clearTimeout();
      this.clearForceKill();
      await rm(runtimeDirectory, { recursive: true, force: true });
    }
  }

  abort(): Promise<void> {
    this.abortRequested = true;
    this.terminateProcess();
    this.clearTimeout();
    return Promise.resolve();
  }

  private async runHermes(
    promptFile: string,
    usageFile: string,
    runtimeDirectory: string,
    onProgress: (info: { logs: string }) => void
  ): Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
  }> {
    const configuredExecutable =
      this.input.hermesExecutablePath?.trim() || 'hermes';
    const childEnv = {
      ...process.env,
      ...this.input.env
    };
    const hermesArgs = buildHermesArguments({
      prompt: HERMES_PROMPT_ARGUMENT_MARKER,
      usageFile,
      profile: this.input.hermesProfile,
      model: this.input.model,
      provider: this.input.hermesProvider,
      toolsets: this.input.hermesToolsets
    });
    const command = await prepareHermesCommand({
      configuredExecutable,
      workspaceRoot: this.input.workspaceRoot,
      runtimeDirectory,
      promptFile,
      hermesArgs,
      env: childEnv
    });

    return new Promise((resolve, reject) => {
      const child = spawn(command.executable, command.args, {
        cwd: this.input.workspaceRoot,
        env: childEnv,
        detached: process.platform !== 'win32',
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.process = child;
      let stdout = '';
      let stderr = '';

      child.stdin.end();
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        const visibleChunk = chunk.trim();
        if (visibleChunk) {
          onProgress({
            logs: `[hermes:stderr] ${visibleChunk}`
          });
        }
      });

      child.once('error', (error) => {
        this.process = null;
        this.clearForceKill();
        reject(error);
      });

      child.once('close', (code, signal) => {
        this.process = null;
        this.clearForceKill();
        resolve({ stdout, stderr, code, signal });
      });
    });
  }

  private startTimeout() {
    if (!this.input.timeoutMs || this.input.timeoutMs <= 0) {
      return;
    }

    this.timeoutHandle = setTimeout(() => {
      this.timeoutTriggered = true;
      this.terminateProcess();
    }, this.input.timeoutMs);
  }

  private terminateProcess() {
    if (!this.process) {
      return;
    }

    signalProcess(this.process, 'SIGTERM');
    this.clearForceKill();
    this.forceKillHandle = setTimeout(() => {
      if (this.process) {
        signalProcess(this.process, 'SIGKILL');
      }
    }, HERMES_TERMINATE_GRACE_MS);
  }

  private clearTimeout() {
    if (!this.timeoutHandle) {
      return;
    }

    clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }

  private clearForceKill() {
    if (!this.forceKillHandle) {
      return;
    }

    clearTimeout(this.forceKillHandle);
    this.forceKillHandle = null;
  }
}

async function prepareHermesCommand(input: {
  configuredExecutable: string;
  workspaceRoot: string;
  runtimeDirectory: string;
  promptFile: string;
  hermesArgs: string[];
  env: NodeJS.ProcessEnv;
}): Promise<{ executable: string; args: string[] }> {
  const resolvedExecutable = await resolveExecutablePath(
    input.configuredExecutable,
    input.workspaceRoot,
    input.env
  );
  const shebang = resolvedExecutable
    ? await readExecutableShebang(resolvedExecutable)
    : null;
  const runnerType = shebang ? detectRunnerType(shebang) : null;

  if (resolvedExecutable && shebang && runnerType) {
    const launcherPath = path.join(
      input.runtimeDirectory,
      runnerType === 'python' ? 'hermes-launcher.py' : 'hermes-launcher.mjs'
    );
    await writeFile(
      launcherPath,
      runnerType === 'python'
        ? buildPythonHermesLauncher()
        : buildNodeHermesLauncher(),
      { encoding: 'utf8', mode: 0o600 }
    );

    return {
      executable: shebang.executable,
      args: [
        ...shebang.args,
        launcherPath,
        resolvedExecutable,
        input.promptFile,
        ...input.hermesArgs
      ]
    };
  }

  const prompt = await readFile(input.promptFile, 'utf8');
  if (Buffer.byteLength(prompt, 'utf8') > HERMES_DIRECT_PROMPT_LIMIT_BYTES) {
    throw new Error(
      `Hermes executable ${input.configuredExecutable} is not a supported Python or Node launcher; cannot safely pass a prompt larger than ${HERMES_DIRECT_PROMPT_LIMIT_BYTES} bytes`
    );
  }

  return {
    executable: input.configuredExecutable,
    args: replacePromptMarker(input.hermesArgs, prompt)
  };
}

async function resolveExecutablePath(
  executable: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv
): Promise<string | null> {
  if (path.isAbsolute(executable) || executable.includes(path.sep)) {
    const candidate = path.isAbsolute(executable)
      ? executable
      : path.resolve(workspaceRoot, executable);
    return (await isExecutable(candidate)) ? candidate : null;
  }

  for (const directory of (env.PATH ?? '').split(path.delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = path.join(directory, executable);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readExecutableShebang(filePath: string): Promise<{
  executable: string;
  args: string[];
} | null> {
  try {
    const firstLine = (await readFile(filePath, 'utf8')).split(/\r?\n/, 1)[0];
    if (!firstLine?.startsWith('#!')) {
      return null;
    }
    const tokens = firstLine.slice(2).trim().split(/\s+/).filter(Boolean);
    const executable = tokens.shift();
    return executable ? { executable, args: tokens } : null;
  } catch {
    return null;
  }
}

function detectRunnerType(input: {
  executable: string;
  args: string[];
}): 'python' | 'node' | null {
  const commandNames = [input.executable, ...input.args].map((value) =>
    path.basename(value).toLowerCase()
  );
  if (commandNames.some((value) => value.startsWith('python'))) {
    return 'python';
  }
  if (commandNames.some((value) => value === 'node' || value === 'node.exe')) {
    return 'node';
  }
  return null;
}

function buildPythonHermesLauncher(): string {
  return [
    'from pathlib import Path',
    'import runpy',
    'import sys',
    '',
    'executable = sys.argv[1]',
    'prompt_file = sys.argv[2]',
    'arguments = sys.argv[3:]',
    "prompt = Path(prompt_file).read_text(encoding='utf-8')",
    `arguments = [prompt if value == '${HERMES_PROMPT_ARGUMENT_MARKER}' else value for value in arguments]`,
    "sys.argv = [executable, *arguments]",
    "runpy.run_path(executable, run_name='__main__')",
    ''
  ].join('\n');
}

function buildNodeHermesLauncher(): string {
  return [
    "import { readFile } from 'node:fs/promises';",
    "import { pathToFileURL } from 'node:url';",
    '',
    'const [executable, promptFile, ...hermesArguments] = process.argv.slice(2);',
    "const prompt = await readFile(promptFile, 'utf8');",
    `const resolvedArguments = hermesArguments.map((value) => value === '${HERMES_PROMPT_ARGUMENT_MARKER}' ? prompt : value);`,
    'process.argv = [process.execPath, executable, ...resolvedArguments];',
    'await import(pathToFileURL(executable).href);',
    ''
  ].join('\n');
}

function replacePromptMarker(args: string[], prompt: string): string[] {
  return args.map((value) =>
    value === HERMES_PROMPT_ARGUMENT_MARKER ? prompt : value
  );
}

function buildHermesArguments(input: {
  prompt: string;
  usageFile: string;
  profile?: string;
  model?: string;
  provider?: string;
  toolsets?: string;
}): string[] {
  const args: string[] = [];

  if (input.profile?.trim()) {
    args.push('--profile', input.profile.trim());
  }

  args.push('-z', input.prompt, '--usage-file', input.usageFile);

  if (input.model?.trim()) {
    args.push('--model', input.model.trim());
  }

  if (input.provider?.trim()) {
    args.push('--provider', input.provider.trim());
  }

  if (input.toolsets?.trim()) {
    args.push('--toolsets', input.toolsets.trim());
  }

  return args;
}

async function buildHermesPrompt(
  workspaceRoot: string,
  taskPrompt: string
): Promise<string> {
  const skillsRoot = path.join(workspaceRoot, '.agents', 'skills');
  const skillEntries = await readdir(skillsRoot, { withFileTypes: true }).catch(
    () => []
  );
  const skillNames = skillEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (skillNames.length === 0) {
    return taskPrompt;
  }

  const skillBlocks = await Promise.all(
    skillNames.map(async (skillName) => {
      const skillDirectory = path.join(skillsRoot, skillName);
      const skillFile = path.join(skillDirectory, 'SKILL.md');
      const content = await readFile(skillFile, 'utf8');
      const expandedContent = content.replaceAll(
        '${HERMES_SKILL_DIR}',
        skillDirectory
      );

      return [
        `<task-skill name="${escapeXmlAttribute(skillName)}" source=".agents/skills/${escapeXmlAttribute(skillName)}/SKILL.md">`,
        expandedContent,
        '</task-skill>'
      ].join('\n');
    })
  );

  return [
    '<task-skills>',
    'The following ONES task skills are mandatory for this run. Follow their instructions and resolve referenced files relative to each skill source directory.',
    ...skillBlocks,
    '</task-skills>',
    '',
    taskPrompt
  ].join('\n');
}

async function readHermesUsage(
  usageFile: string
): Promise<AgentTokenUsage | null> {
  try {
    const report = JSON.parse(await readFile(usageFile, 'utf8')) as {
      input_tokens?: unknown;
      output_tokens?: unknown;
    };

    return {
      inputTokens: toOptionalNumber(report.input_tokens),
      outputTokens: toOptionalNumber(report.output_tokens)
    };
  } catch {
    return null;
  }
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeHermesError(
  error: unknown,
  usage: AgentTokenUsage | null
): AgentSessionExecutionError {
  if (error instanceof AgentSessionExecutionError) {
    return error;
  }

  return new AgentSessionExecutionError(
    error instanceof Error ? error.message : String(error),
    usage,
    { cause: error }
  );
}

function signalProcess(
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals
) {
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to signaling the direct child below.
    }
  }

  child.kill(signal);
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export const __testing = {
  buildHermesArguments,
  buildHermesPrompt,
  readHermesUsage
};
