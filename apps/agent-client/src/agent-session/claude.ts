import * as ClaudeAgentSdk from '@anthropic-ai/claude-agent-sdk';
import type { AgentTokenUsage } from '@ones-ai-workflow/shared';
import type {
  Options,
  SDKAssistantMessage,
  SDKMessage,
  Query,
  SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk';
import {
  AgentSession,
  AgentSessionExecutionError,
  type AgentSessionExecuteResult
} from './types.js';

type ClaudeQueryFactory = (params: {
  prompt: string;
  options?: Options;
}) => Query;

let claudeQuery: ClaudeQueryFactory = ClaudeAgentSdk.query;

export class ClaudeAgentSession extends AgentSession {
  private readonly abortController = new AbortController();
  private timeoutHandle: NodeJS.Timeout | null = null;
  private timeoutTriggered = false;
  private query: ClaudeAgentSdk.Query | null = null;

  async execute(
    onProgress: (info: { logs: string }) => void
  ): Promise<AgentSessionExecuteResult> {
    this.startTimeout();
    onProgress({
      logs: '[agent-session] claude session started'
    });

    try {
      const environment = buildClaudeEnvironment(this.input.env);
      this.query = claudeQuery({
        prompt: this.input.prompt,
        options: {
          abortController: this.abortController,
          cwd: this.input.workspaceRoot,
          model: this.input.model,
          pathToClaudeCodeExecutable: 'claude',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          ...(environment ? { env: environment } : {}),
          tools: {
            type: 'preset',
            preset: 'claude_code'
          }
        }
      });

      for await (const message of this.query) {
        const result = this.handleMessage(message, onProgress);
        if (result) {
          onProgress({
            logs: '[agent-session] claude session completed'
          });
          return result;
        }
      }

      throw new AgentSessionExecutionError(
        'claude session finished without result',
        null
      );
    } catch (error) {
      const message = this.getErrorMessage(error);

      onProgress({
        logs: `[agent-session] claude session failed: ${message}`
      });

      if (
        error instanceof AgentSessionExecutionError &&
        error.message === message
      ) {
        throw error;
      }

      throw new AgentSessionExecutionError(message, extractUsageFromError(error), {
        cause: error
      });
    } finally {
      this.query = null;
      this.clearTimeout();
    }
  }

  abort(): Promise<void> {
    this.abortController.abort();
    this.query?.close();
    this.clearTimeout();
    return Promise.resolve();
  }

  private handleMessage(
    message: SDKMessage,
    onProgress: (info: { logs: string }) => void
  ): AgentSessionExecuteResult | null {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          onProgress({
            logs: `[agent-session] claude session initialized: ${message.session_id}`
          });
        }
        return null;
      case 'assistant':
        this.reportAssistantMessage(message, onProgress);
        return null;
      case 'result':
        return this.handleResultMessage(message);
      default:
        return null;
    }
  }

  private reportAssistantMessage(
    message: SDKAssistantMessage,
    onProgress: (info: { logs: string }) => void
  ) {
    const content = message.message.content;

    if (!Array.isArray(content)) {
      return;
    }

    for (const block of content) {
      if (block.type !== 'tool_use') {
        continue;
      }

      const toolLog = formatClaudeToolUseLog(block.name, block.input);
      if (toolLog) {
        onProgress({ logs: toolLog });
      }
    }
  }

  private handleResultMessage(
    message: SDKResultMessage
  ): AgentSessionExecuteResult {
    const usage = extractClaudeUsage(message);

    if (message.subtype === 'success') {
      return {
        result: message.result ?? '',
        usage
      };
    }

    const errors = Array.isArray(message.errors)
      ? message.errors.filter(Boolean)
      : [];
    if (errors.length > 0) {
      throw new AgentSessionExecutionError(errors.join('\n'), usage);
    }

    throw new AgentSessionExecutionError(message.subtype, usage);
  }

  private startTimeout() {
    if (!this.input.timeoutMs || this.input.timeoutMs <= 0) {
      return;
    }

    this.timeoutHandle = setTimeout(() => {
      this.timeoutTriggered = true;
      this.abortController.abort();
      this.query?.close();
    }, this.input.timeoutMs);
  }

  private clearTimeout() {
    if (!this.timeoutHandle) {
      return;
    }

    clearTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }

  private getErrorMessage(error: unknown): string {
    if (this.timeoutTriggered) {
      return `timed out after ${this.input.timeoutMs}ms`;
    }

    if (this.abortController.signal.aborted) {
      return 'aborted';
    }

    return error instanceof Error ? error.message : String(error);
  }
}

function extractClaudeUsage(message: SDKResultMessage): AgentTokenUsage | null {
  const usage = (message as { usage?: unknown }).usage;

  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return null;
  }

  const usageRecord = usage as {
    input_tokens?: unknown;
    output_tokens?: unknown;
  };

  return {
    inputTokens: toOptionalNumber(usageRecord.input_tokens),
    outputTokens: toOptionalNumber(usageRecord.output_tokens)
  };
}

function extractUsageFromError(error: unknown): AgentTokenUsage | null {
  return error instanceof AgentSessionExecutionError ? error.usage : null;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatClaudeToolUseLog(
  toolName: string,
  input: unknown
): string | null {
  const normalizedInput =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  switch (toolName) {
    case 'Bash': {
      const command = getStringField(normalizedInput, ['command', 'cmd']);
      return command
        ? `[agent-session] command started: ${command}`
        : '[agent-session] command started';
    }
    case 'Write':
    case 'Edit':
    case 'MultiEdit': {
      const filePath = getStringField(normalizedInput, [
        'file_path',
        'path',
        'filename'
      ]);
      return filePath
        ? `[agent-session] file change requested: ${toolName} ${filePath}`
        : `[agent-session] file change requested: ${toolName}`;
    }
    case 'Read':
    case 'Glob':
    case 'Grep':
    case 'WebSearch':
    case 'WebFetch':
      return `[agent-session] tool requested: ${toolName}`;
    default:
      return `[agent-session] tool requested: ${toolName}`;
  }
}

function getStringField(
  value: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    const candidate = value[field];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function buildClaudeEnvironment(
  inputEnv?: Record<string, string>
): Record<string, string> | undefined {
  if (!inputEnv || Object.keys(inputEnv).length === 0) {
    return undefined;
  }

  const environment: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      environment[key] = value;
    }
  }

  for (const [key, value] of Object.entries(inputEnv ?? {})) {
    environment[key] = value;
  }

  return environment;
}

export function setClaudeQueryImplementationForTest(
  implementation: ClaudeQueryFactory | null
) {
  claudeQuery = implementation ?? ClaudeAgentSdk.query;
}
