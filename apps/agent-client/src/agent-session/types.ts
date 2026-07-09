import type { AgentTokenUsage } from '@ones-ai-workflow/shared';

export type ExecuteAgentType = 'codex' | 'claude' | 'hermes';
export type ModelReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export interface AgentSessionInput {
  workspaceRoot: string;
  prompt: string;
  env?: Record<string, string>;
  codexHomePath?: string;
  codexApiKey?: string;
  codexBaseUrl?: string;
  hermesCommandTemplate?: string;
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
  timeoutMs?: number;
}

export interface AgentSessionExecuteResult {
  result: string;
  usage: AgentTokenUsage | null;
}

export class AgentSessionExecutionError extends Error {
  readonly usage: AgentTokenUsage | null;

  constructor(
    message: string,
    usage: AgentTokenUsage | null,
    options?: {
      cause?: unknown;
    }
  ) {
    super(message, options);
    this.name = 'AgentSessionExecutionError';
    this.usage = usage;
  }
}

export abstract class AgentSession {
  protected readonly input: AgentSessionInput;

  constructor(input: AgentSessionInput) {
    this.input = input;
  }

  abstract execute(
    onProgress: (info: { logs: string }) => void
  ): Promise<AgentSessionExecuteResult>;

  abstract abort(): Promise<void> | void;
}
