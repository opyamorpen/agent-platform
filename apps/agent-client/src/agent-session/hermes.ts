import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  AgentSession,
  AgentSessionExecutionError,
  type AgentSessionExecuteResult
} from './types.js';

const HERMES_PROMPT_DIRECTORY_NAME = '.hermes-agent-client';

export class HermesAgentSession extends AgentSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private timeoutTriggered = false;

  async execute(
    onProgress: (info: { logs: string }) => void
  ): Promise<AgentSessionExecuteResult> {
    const commandTemplate = this.input.hermesCommandTemplate?.trim();

    if (!commandTemplate) {
      throw new AgentSessionExecutionError(
        'AGENT_CLIENT_HERMES_COMMAND_TEMPLATE is required when using hermes',
        null
      );
    }

    const promptDirectory = path.join(
      this.input.workspaceRoot,
      HERMES_PROMPT_DIRECTORY_NAME
    );
    const promptFile = path.join(promptDirectory, `${randomUUID()}.prompt.txt`);
    await mkdir(promptDirectory, { recursive: true });
    await writeFile(promptFile, this.input.prompt, 'utf8');

    const command = buildHermesCommand(commandTemplate, {
      prompt: this.input.prompt,
      promptFile,
      workspaceRoot: this.input.workspaceRoot,
      model: this.input.model
    });
    const passesPromptByPlaceholder =
      commandTemplate.includes('{promptFile}') ||
      commandTemplate.includes('{prompt}');

    this.startTimeout();
    onProgress({
      logs: '[agent-session] hermes session started'
    });
    onProgress({
      logs: `[agent-session] hermes command: ${redactPromptPath(command, promptFile)}`
    });

    try {
      const result = await this.runCommand(command, passesPromptByPlaceholder, onProgress);

      onProgress({
        logs: '[agent-session] hermes session completed'
      });

      return {
        result,
        usage: null
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      onProgress({
        logs: `[agent-session] hermes session failed: ${message}`
      });

      if (
        error instanceof AgentSessionExecutionError &&
        error.message === message
      ) {
        throw error;
      }

      throw new AgentSessionExecutionError(message, null, {
        cause: error
      });
    } finally {
      this.clearTimeout();
      await rm(promptFile, { force: true });
    }
  }

  abort(): Promise<void> {
    this.process?.kill('SIGTERM');
    this.clearTimeout();
    return Promise.resolve();
  }

  private runCommand(
    command: string,
    passesPromptByPlaceholder: boolean,
    onProgress: (info: { logs: string }) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd: this.input.workspaceRoot,
        env: {
          ...process.env,
          ...this.input.env
        },
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.process = child;
      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        const visibleChunk = chunk.trim();
        if (visibleChunk) {
          onProgress({
            logs: `[hermes:stdout] ${visibleChunk}`
          });
        }
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

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code, signal) => {
        this.process = null;

        if (this.timeoutTriggered) {
          reject(new Error('timed out'));
          return;
        }

        if (code === 0) {
          resolve(stdout.trim());
          return;
        }

        const detail = stderr.trim() || stdout.trim() || signal || 'unknown error';
        reject(new Error(`hermes command exited with code ${code}: ${detail}`));
      });

      if (!passesPromptByPlaceholder) {
        child.stdin.write(this.input.prompt);
      }
      child.stdin.end();
    });
  }

  private startTimeout() {
    if (!this.input.timeoutMs || this.input.timeoutMs <= 0) {
      return;
    }

    this.timeoutHandle = setTimeout(() => {
      this.timeoutTriggered = true;
      void this.abort();
    }, this.input.timeoutMs);
  }

  private clearTimeout() {
    if (!this.timeoutHandle) {
      return;
    }

    clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }
}

function buildHermesCommand(
  template: string,
  values: {
    prompt: string;
    promptFile: string;
    workspaceRoot: string;
    model?: string;
  }
) {
  return template
    .replace(/\{promptFile\}/g, shellQuote(values.promptFile))
    .replace(/\{prompt\}/g, shellQuote(values.prompt))
    .replace(/\{workspaceRoot\}/g, shellQuote(values.workspaceRoot))
    .replace(/\{model\}/g, shellQuote(values.model ?? ''));
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function redactPromptPath(command: string, promptFile: string) {
  return command.replace(shellQuote(promptFile), "'<prompt-file>'");
}

export const __testing = {
  buildHermesCommand,
  shellQuote
};
