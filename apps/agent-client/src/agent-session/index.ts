import type {
  AgentSession,
  AgentSessionInput,
  ExecuteAgentType
} from './types.js';
import { ClaudeAgentSession } from './claude.js';
import { CodexAgentSession } from './codex.js';
import { AgentSession as BaseAgentSession } from './types.js';

export { AgentSession, AgentSessionExecutionError } from './types.js';

export type { AgentSessionInput as AgentSessionConfig } from './types.js';

class EmptyAgentSession extends BaseAgentSession {
  private readonly executeAgentType: ExecuteAgentType;

  constructor(input: AgentSessionInput, executeAgentType: ExecuteAgentType) {
    super(input);
    this.executeAgentType = executeAgentType;
  }

  async execute(
    onProgress: (info: { logs: string }) => void
  ) {
    onProgress({
      logs: `[agent-session] execute is not implemented for ${this.executeAgentType}`
    });
    return {
      result: '',
      usage: null
    };
  }

  abort(): Promise<void> {
    return Promise.resolve();
  }
}

export function createAgentSession(
  input: AgentSessionInput,
  executeAgentType: ExecuteAgentType = 'codex'
): AgentSession {
  if (executeAgentType === 'codex') {
    return new CodexAgentSession(input);
  }

  if (executeAgentType === 'claude') {
    return new ClaudeAgentSession(input);
  }

  return new EmptyAgentSession(input, executeAgentType);
}
