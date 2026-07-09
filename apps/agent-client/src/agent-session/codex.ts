import { Codex, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk';
import type { AgentTokenUsage } from '@ones-ai-workflow/shared';
import {
  AgentSession,
  AgentSessionExecutionError,
  type AgentSessionExecuteResult
} from './types.js';

export class CodexAgentSession extends AgentSession {
  private readonly abortController = new AbortController();
  private timeoutHandle: NodeJS.Timeout | null = null;
  private timeoutTriggered = false;

  async execute(
    onProgress: (info: { logs: string }) => void
  ): Promise<AgentSessionExecuteResult> {
    const codex = new Codex({
      env: buildCodexEnvironment(
        this.input.env,
        this.input.codexHomePath,
        this.input.codexApiKey
      ),
      apiKey: this.input.codexApiKey,
      baseUrl: this.input.codexBaseUrl
    });
    const thread = codex.startThread({
      model: this.input.model,
      modelReasoningEffort: this.input.modelReasoningEffort,
      workingDirectory: this.input.workspaceRoot,
      skipGitRepoCheck: true,
      sandboxMode: 'danger-full-access',
      approvalPolicy: 'never'
    });
    const responseItemOrder: string[] = [];
    const responseItemText = new Map<string, string>();
    const visibleItemOutput = new Map<string, string>();
    let usage: AgentTokenUsage | null = null;

    this.startTimeout();
    onProgress({
      logs: '[agent-session] codex session started'
    });

    try {
      const { events } = await thread.runStreamed(this.input.prompt, {
        signal: this.abortController.signal
      });

      for await (const event of events) {
        this.handleEvent(
          event,
          onProgress,
          responseItemOrder,
          responseItemText,
          visibleItemOutput,
          (nextUsage) => {
            usage = nextUsage;
          }
        );
      }

      const finalResponse = responseItemOrder
        .map((id) => responseItemText.get(id)?.trim() ?? '')
        .filter(Boolean)
        .join('\n\n');

      onProgress({
        logs: '[agent-session] codex session completed'
      });

      return {
        result: finalResponse,
        usage
      };
    } catch (error) {
      const message = this.getErrorMessage(error);

      onProgress({
        logs: `[agent-session] codex session failed: ${message}`
      });

      if (
        error instanceof AgentSessionExecutionError &&
        error.message === message
      ) {
        throw error;
      }

      throw new AgentSessionExecutionError(message, usage, {
        cause: error
      });
    } finally {
      this.clearTimeout();
    }
  }

  abort(): Promise<void> {
    this.abortController.abort();
    this.clearTimeout();
    return Promise.resolve();
  }

  private handleEvent(
    event: ThreadEvent,
    onProgress: (info: { logs: string }) => void,
    responseItemOrder: string[],
    responseItemText: Map<string, string>,
    visibleItemOutput: Map<string, string>,
    onUsage: (usage: AgentTokenUsage | null) => void
  ) {
    switch (event.type) {
      case 'thread.started':
        onProgress({
          logs: `[agent-session] thread started: ${event.thread_id}`
        });
        return;
      case 'turn.started':
        onProgress({
          logs: '[agent-session] turn started'
        });
        return;
      case 'turn.completed':
        onUsage(extractCodexUsage(event));
        onProgress({
          logs: '[agent-session] turn completed'
        });
        return;
      case 'turn.failed':
        throw new AgentSessionExecutionError(event.error.message, null, {
          cause: event.error
        });
      case 'error':
        throw new AgentSessionExecutionError(event.message, null);
      case 'item.started':
      case 'item.updated':
      case 'item.completed':
        this.captureResponseItem(event.item, responseItemOrder, responseItemText);
        const visibleOutput = captureVisibleItemOutput(
          event.item,
          visibleItemOutput
        );

        if (visibleOutput) {
          onProgress({ logs: visibleOutput });
        }

        if (event.type !== 'item.updated') {
          const message = formatItemEventLog(event.type, event.item);
          if (message) {
            onProgress({ logs: message });
          }
        }
        return;
      default:
        return;
    }
  }

  private captureResponseItem(
    item: ThreadItem,
    responseItemOrder: string[],
    responseItemText: Map<string, string>
  ) {
    if (item.type !== 'agent_message') {
      return;
    }

    if (!responseItemText.has(item.id)) {
      responseItemOrder.push(item.id);
    }

    responseItemText.set(item.id, item.text);
  }

  private startTimeout() {
    if (!this.input.timeoutMs || this.input.timeoutMs <= 0) {
      return;
    }

    this.timeoutHandle = setTimeout(() => {
      this.timeoutTriggered = true;
      this.abortController.abort();
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

function extractCodexUsage(event: ThreadEvent): AgentTokenUsage | null {
  if (event.type !== 'turn.completed') {
    return null;
  }

  return {
    inputTokens: toOptionalNumber(
      (event as { usage?: { input_tokens?: unknown } }).usage?.input_tokens
    ),
    outputTokens: toOptionalNumber(
      (event as { usage?: { output_tokens?: unknown } }).usage?.output_tokens
    )
  };
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatItemEventLog(
  eventType: 'item.started' | 'item.completed',
  item: ThreadItem
): string | null {
  switch (item.type) {
    case 'command_execution':
      if (eventType === 'item.started') {
        return `[agent-session] command started: ${item.command}`;
      }

      return `[agent-session] command ${item.status}: ${item.command}${
        typeof item.exit_code === 'number' ? ` (exit ${item.exit_code})` : ''
      }`;
    case 'mcp_tool_call':
      if (eventType === 'item.started') {
        return `[agent-session] mcp tool started: ${item.server}/${item.tool}`;
      }

      return `[agent-session] mcp tool ${item.status}: ${item.server}/${item.tool}`;
    case 'file_change':
      return `[agent-session] file change ${item.status}: ${item.changes
        .map((change) => `${change.kind} ${change.path}`)
        .join(', ')}`;
    case 'web_search':
      return `[agent-session] web search: ${item.query}`;
    case 'todo_list':
      return `[agent-session] todo list updated: ${item.items.length} item(s)`;
    case 'reasoning':
      return '[agent-session] reasoning generated';
    case 'error':
      return `[agent-session] item error: ${item.message}`;
    case 'agent_message':
      return eventType === 'item.completed'
        ? '[agent-session] agent response completed'
        : null;
    default:
      return null;
  }
}

function captureVisibleItemOutput(
  item: ThreadItem,
  visibleItemOutput: Map<string, string>
): string | null {
  switch (item.type) {
    case 'agent_message':
      return captureVisibleTextDelta(
        item.id,
        item.text,
        visibleItemOutput,
        '[agent-session] agent message'
      );
    default:
      return null;
  }
}

function captureVisibleTextDelta(
  itemId: string,
  nextValue: string,
  visibleItemOutput: Map<string, string>,
  label: string
): string | null {
  const previousValue = visibleItemOutput.get(itemId) ?? '';

  if (nextValue === previousValue) {
    return null;
  }

  visibleItemOutput.set(itemId, nextValue);

  const delta = nextValue.startsWith(previousValue)
    ? nextValue.slice(previousValue.length)
    : nextValue;
  const normalizedDelta = delta.trim();

  if (!normalizedDelta) {
    return null;
  }

  return `${label}:\n${normalizedDelta}`;
}

function buildCodexEnvironment(
  inputEnv?: Record<string, string>,
  codexHomePath?: string,
  codexApiKey?: string
): Record<string, string> {
  const environment: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      environment[key] = value;
    }
  }

  for (const [key, value] of Object.entries(inputEnv ?? {})) {
    environment[key] = value;
  }

  if (codexHomePath) {
    environment.CODEX_HOME = codexHomePath;
  }

  if (codexApiKey) {
    environment.CODEX_API_KEY = codexApiKey;
  }

  return environment;
}
