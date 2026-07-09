import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import {
  findAgentClientByTokenHash,
  touchAgentClientTokenUsage
} from '../modules/agent-clients/repository.js';

export interface AuthenticatedAgentClient {
  uuid: string;
  name: string;
  tokenHash: string;
}

export class AgentClientAuthError extends Error {
  constructor(message = 'Unauthorized agent client request') {
    super(message);
    this.name = 'AgentClientAuthError';
  }
}

function getBearerToken(c: Context): string | null {
  const authorization = c.req.header('authorization');

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function authenticateAgentClientRequest(
  c: Context
): Promise<AuthenticatedAgentClient> {
  const token = getBearerToken(c);

  if (!token) {
    throw new AgentClientAuthError('Missing agent client token');
  }

  const tokenHash = sha256(token);
  const agentClient = await findAgentClientByTokenHash(tokenHash);

  if (
    !agentClient ||
    agentClient.connectionStatus !== 'active'
  ) {
    throw new AgentClientAuthError();
  }

  await touchAgentClientTokenUsage({
    uuid: agentClient.uuid,
    tokenHash,
    usedAt: new Date()
  });

  return {
    uuid: agentClient.uuid,
    name: agentClient.name,
    tokenHash
  };
}
