import { createEntityStore } from '../../lib/hosted-storage.js';
import type { AgentClientConnectionStatus } from '@ones-ai-workflow/shared';

const AGENT_CLIENT_ENTITY_NAME = 'agent_client';

const agentClientStore = createEntityStore<StoredAgentClientEntity>(
  AGENT_CLIENT_ENTITY_NAME
);

export interface AgentClientRecord {
  uuid: string;
  name: string;
  hostname: string;
  version: string;
  connectionStatus: AgentClientConnectionStatus;
  pendingRequestUUID: string | null;
  pendingConnectCodeHash: string | null;
  tokenHash: string | null;
  requestedAt: Date;
  approvedAt: Date | null;
  revokedAt: Date | null;
  lastExchangeAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredAgentClientEntity {
  uuid: string;
  name: string;
  status: string;
  hostname: string;
  version: string;
  connection_status: AgentClientConnectionStatus;
  pending_request_uuid: string;
  pending_connect_code_hash: string;
  token_hash: string;
  requested_at: number;
  approved_at: number;
  revoked_at: number;
  last_used_at: number;
  last_exchange_at: number;
  created_at: number;
  updated_at: number;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function toTimestamp(value: Date | null | undefined): number {
  return value instanceof Date ? value.getTime() : 0;
}

function fromTimestamp(value: number): Date | null {
  return value > 0 ? new Date(value) : null;
}

function getAgentClientKey(uuid: string): string {
  return `agent_client_${normalizeKeySegment(uuid)}`;
}

function toAgentClientRecord(record: StoredAgentClientEntity): AgentClientRecord {
  return {
    uuid: record.uuid,
    name: record.name,
    hostname: record.hostname,
    version: record.version,
    connectionStatus: record.connection_status,
    pendingRequestUUID: record.pending_request_uuid || null,
    pendingConnectCodeHash: record.pending_connect_code_hash || null,
    tokenHash: record.token_hash || null,
    requestedAt: new Date(record.requested_at),
    approvedAt: fromTimestamp(record.approved_at),
    revokedAt: fromTimestamp(record.revoked_at),
    lastUsedAt: fromTimestamp(record.last_used_at),
    lastExchangeAt: fromTimestamp(record.last_exchange_at),
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at)
  };
}

async function getStoredAgentClientByUUID(
  uuid: string
): Promise<StoredAgentClientEntity | null> {
  return (await agentClientStore.get(getAgentClientKey(uuid))) ?? null;
}

export async function findAgentClientByUUID(
  uuid: string
): Promise<AgentClientRecord | null> {
  const record = await getStoredAgentClientByUUID(uuid);
  return record ? toAgentClientRecord(record) : null;
}

export async function listAgentClients(): Promise<AgentClientRecord[]> {
  const entries = await agentClientStore.getMany();

  return entries
    .map((entry) => entry.value)
    .sort((left, right) =>
      right.last_exchange_at !== left.last_exchange_at
        ? right.last_exchange_at - left.last_exchange_at
        : right.updated_at - left.updated_at
    )
    .map(toAgentClientRecord);
}

export async function upsertAgentClientConnectionRequest(input: {
  uuid: string;
  name: string;
  hostname: string;
  version: string;
  pendingRequestUUID: string;
  pendingConnectCodeHash: string;
  requestedAt: Date;
}): Promise<AgentClientRecord> {
  const now = Date.now();
  const existing = await getStoredAgentClientByUUID(input.uuid);

  const nextRecord: StoredAgentClientEntity = {
    uuid: input.uuid,
    name: input.name,
    status: 'pending_approval',
    hostname: input.hostname,
    version: input.version,
    connection_status: 'pending_approval',
    pending_request_uuid: input.pendingRequestUUID,
    pending_connect_code_hash: input.pendingConnectCodeHash,
    token_hash: '',
    requested_at: input.requestedAt.getTime(),
    approved_at: 0,
    revoked_at: 0,
    last_used_at: existing?.last_used_at ?? 0,
    last_exchange_at: existing?.last_exchange_at ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: now
  };

  await agentClientStore.set(getAgentClientKey(input.uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}

export async function approveAgentClient(input: {
  uuid: string;
  approvedAt: Date;
}): Promise<AgentClientRecord | null> {
  const existing = await getStoredAgentClientByUUID(input.uuid);

  if (!existing) {
    return null;
  }

  const nextRecord: StoredAgentClientEntity = {
    ...existing,
    status: 'approved',
    connection_status: 'approved',
    approved_at: input.approvedAt.getTime(),
    revoked_at: 0,
    updated_at: Date.now()
  };

  await agentClientStore.set(getAgentClientKey(input.uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}

export async function activateAgentClient(input: {
  uuid: string;
  tokenHash: string;
  activatedAt: Date;
}): Promise<AgentClientRecord | null> {
  const existing = await getStoredAgentClientByUUID(input.uuid);

  if (!existing) {
    return null;
  }

  const nextRecord: StoredAgentClientEntity = {
    ...existing,
    status: 'active',
    connection_status: 'active',
    pending_request_uuid: '',
    pending_connect_code_hash: '',
    token_hash: input.tokenHash,
    last_used_at: input.activatedAt.getTime(),
    revoked_at: 0,
    updated_at: Date.now()
  };

  await agentClientStore.set(getAgentClientKey(input.uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}

export async function revokeAgentClient(
  uuid: string,
  revokedAt: Date
): Promise<AgentClientRecord | null> {
  const existing = await getStoredAgentClientByUUID(uuid);

  if (!existing) {
    return null;
  }

  const nextRecord: StoredAgentClientEntity = {
    ...existing,
    status: 'revoked',
    connection_status: 'revoked',
    pending_request_uuid: '',
    pending_connect_code_hash: '',
    token_hash: '',
    revoked_at: revokedAt.getTime(),
    updated_at: Date.now()
  };

  await agentClientStore.set(getAgentClientKey(uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}

export async function touchAgentClientExchange(input: {
  uuid: string;
  exchangedAt: Date;
}): Promise<AgentClientRecord | null> {
  const existing = await getStoredAgentClientByUUID(input.uuid);

  if (!existing) {
    return null;
  }

  const nextRecord: StoredAgentClientEntity = {
    ...existing,
    last_exchange_at: input.exchangedAt.getTime(),
    last_used_at: input.exchangedAt.getTime(),
    updated_at: Date.now()
  };

  await agentClientStore.set(getAgentClientKey(input.uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}

export async function findAgentClientByTokenHash(
  tokenHash: string
): Promise<AgentClientRecord | null> {
  const records = await listAgentClients();
  return records.find((record) => record.tokenHash === tokenHash) ?? null;
}

export async function touchAgentClientTokenUsage(input: {
  uuid: string;
  tokenHash: string;
  usedAt: Date;
}): Promise<void> {
  const existing = await getStoredAgentClientByUUID(input.uuid);

  if (!existing || existing.token_hash !== input.tokenHash) {
    return;
  }

  await agentClientStore.set(getAgentClientKey(input.uuid), {
    ...existing,
    last_used_at: input.usedAt.getTime(),
    updated_at: Date.now()
  });
}

export async function updateAgentClientDisplay(input: {
  uuid: string;
  name: string;
  hostname: string;
  version: string;
}): Promise<AgentClientRecord | null> {
  const existing = await getStoredAgentClientByUUID(input.uuid);

  if (!existing) {
    return null;
  }

  const nextRecord: StoredAgentClientEntity = {
    ...existing,
    name: input.name,
    hostname: input.hostname,
    version: input.version,
    updated_at: Date.now()
  };

  await agentClientStore.set(getAgentClientKey(input.uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}
