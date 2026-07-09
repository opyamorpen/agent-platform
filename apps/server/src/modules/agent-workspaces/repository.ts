import type {
  AgentWorkspace,
  AgentWorkspaceAuthSummary,
  AgentWorkspaceRepository
} from '@ones-ai-workflow/shared';
import {
  createEntityStore,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';
import { countWorkspaceCredentialsByWorkspaceUUID } from './credentials-repository.js';

const AGENT_WORKSPACE_ENTITY_NAME = 'agent_workspace';
const REPOSITORY_ENTITY_NAME = 'agent_repo';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const AGENT_WORKSPACE_UUID_INDEX_NAME = 'idx_agent_workspace_uuid';

const agentWorkspaceStore =
  createEntityStore<StoredAgentWorkspaceEntity>(AGENT_WORKSPACE_ENTITY_NAME);
const repositoryStore = createEntityStore<StoredRepositoryEntity>(REPOSITORY_ENTITY_NAME);

interface StoredAgentWorkspaceEntity {
  team_uuid: string;
  uuid: string;
  name: string;
  auth_type?: string;
  ssh_public_key?: string;
  ssh_private_key?: string;
  https_username?: string;
  https_secret_object_key?: string;
  created_at: number;
  updated_at: number;
}

interface StoredRepositoryEntity {
  team_uuid: string;
  uuid: string;
  agent_workspace_uuid: string;
  url: string;
  created_at: number;
  updated_at: number;
}

export interface AgentWorkspaceRecord {
  uuid: string;
  name: string;
  auth: AgentWorkspaceAuthRecord;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentWorkspaceAuthRecord =
  | {
      type: 'none';
    }
  | {
      type: 'ssh';
      publicKey: string | null;
      privateKey: string | null;
    }
  | {
      type: 'https';
      username: string | null;
      secretObjectKey: string | null;
    };

export interface RepositoryRecord extends AgentWorkspaceRepository {
  agentWorkspaceUUID: string;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getAgentWorkspaceKey(uuid: string): string {
  return `agent_workspace_${normalizeKeySegment(uuid)}`;
}

function getRepositoryKey(uuid: string): string {
  return `repository_${normalizeKeySegment(uuid)}`;
}

function normalizeOptionalWorkspaceKey(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function inferStoredWorkspaceAuthType(
  entry: StoredAgentWorkspaceEntity
): 'none' | 'ssh' | 'https' {
  if (entry.auth_type === 'ssh' || entry.auth_type === 'https' || entry.auth_type === 'none') {
    return entry.auth_type;
  }

  if (normalizeOptionalWorkspaceKey(entry.ssh_public_key) || normalizeOptionalWorkspaceKey(entry.ssh_private_key)) {
    return 'ssh';
  }

  if (normalizeOptionalWorkspaceKey(entry.https_username) || normalizeOptionalWorkspaceKey(entry.https_secret_object_key)) {
    return 'https';
  }

  return 'none';
}

function toAgentWorkspaceAuthRecord(
  entry: StoredAgentWorkspaceEntity
): AgentWorkspaceAuthRecord {
  const authType = inferStoredWorkspaceAuthType(entry);

  if (authType === 'ssh') {
    return {
      type: 'ssh',
      publicKey: normalizeOptionalWorkspaceKey(entry.ssh_public_key),
      privateKey: normalizeOptionalWorkspaceKey(entry.ssh_private_key)
    };
  }

  if (authType === 'https') {
    return {
      type: 'https',
      username: normalizeOptionalWorkspaceKey(entry.https_username),
      secretObjectKey: normalizeOptionalWorkspaceKey(entry.https_secret_object_key)
    };
  }

  return {
    type: 'none'
  };
}

function toAgentWorkspaceAuthSummary(
  auth: AgentWorkspaceAuthRecord
): AgentWorkspaceAuthSummary {
  if (auth.type === 'ssh') {
    return {
      type: 'ssh',
      publicKey: auth.publicKey
    };
  }

  if (auth.type === 'https') {
    return {
      type: 'https',
      username: auth.username,
      hasSecret: Boolean(auth.secretObjectKey)
    };
  }

  return {
    type: 'none'
  };
}

function toStoredAuthFields(
  auth: AgentWorkspaceAuthRecord
): Pick<
  StoredAgentWorkspaceEntity,
  | 'auth_type'
  | 'ssh_public_key'
  | 'ssh_private_key'
  | 'https_username'
  | 'https_secret_object_key'
> {
  if (auth.type === 'ssh') {
    return {
      auth_type: 'ssh',
      ssh_public_key: auth.publicKey ?? '',
      ssh_private_key: auth.privateKey ?? '',
      https_username: '',
      https_secret_object_key: ''
    };
  }

  if (auth.type === 'https') {
    return {
      auth_type: 'https',
      ssh_public_key: '',
      ssh_private_key: '',
      https_username: auth.username ?? '',
      https_secret_object_key: auth.secretObjectKey ?? ''
    };
  }

  return {
    auth_type: 'none',
    ssh_public_key: '',
    ssh_private_key: '',
    https_username: '',
    https_secret_object_key: ''
  };
}

function toAgentWorkspaceRecord(
  entry: StoredAgentWorkspaceEntity
): AgentWorkspaceRecord {
  return {
    uuid: entry.uuid,
    name: entry.name,
    auth: toAgentWorkspaceAuthRecord(entry),
    createdAt: new Date(entry.created_at),
    updatedAt: new Date(entry.updated_at)
  };
}

function toRepositoryRecord(entry: StoredRepositoryEntity): RepositoryRecord {
  return {
    uuid: entry.uuid,
    agentWorkspaceUUID: entry.agent_workspace_uuid,
    url: entry.url,
    createdAt: new Date(entry.created_at),
    updatedAt: new Date(entry.updated_at)
  };
}

async function listAgentWorkspaceEntries(
  teamUUID: string
): Promise<
  Array<HostedEntityEntry<StoredAgentWorkspaceEntity>>
> {
  return agentWorkspaceStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listRepositoryEntries(
  teamUUID: string
): Promise<
  Array<HostedEntityEntry<StoredRepositoryEntity>>
> {
  return repositoryStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function getStoredAgentWorkspaceByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredAgentWorkspaceEntity | null> {
  const entry = await agentWorkspaceStore.get(getAgentWorkspaceKey(uuid));

  if (!entry || entry.team_uuid !== teamUUID) {
    return null;
  }

  return entry;
}

async function getStoredRepositoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredRepositoryEntity | null> {
  const entry = await repositoryStore.get(getRepositoryKey(uuid));

  if (!entry || entry.team_uuid !== teamUUID) {
    return null;
  }

  return entry;
}

export async function listAgentWorkspaces(teamUUID: string): Promise<AgentWorkspace[]> {
  const [workspaceEntries, repositoryEntries] = await Promise.all([
    listAgentWorkspaceEntries(teamUUID),
    listRepositoryEntries(teamUUID)
  ]);

  const repositoriesByWorkspaceUUID = new Map<string, AgentWorkspaceRepository[]>();

  for (const repositoryEntry of repositoryEntries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at)) {
    const current = repositoriesByWorkspaceUUID.get(repositoryEntry.agent_workspace_uuid) ?? [];
    current.push({
      uuid: repositoryEntry.uuid,
      url: repositoryEntry.url
    });
    repositoriesByWorkspaceUUID.set(repositoryEntry.agent_workspace_uuid, current);
  }

  const sortedWorkspaceEntries = workspaceEntries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at);
  const credentialCountByWorkspaceUUID = new Map(
    await Promise.all(
      sortedWorkspaceEntries.map(async (workspaceEntry) => [
        workspaceEntry.uuid,
        await countWorkspaceCredentialsByWorkspaceUUID(workspaceEntry.uuid, teamUUID)
      ] as const)
    )
  );

  return sortedWorkspaceEntries.map((workspaceEntry) => ({
    uuid: workspaceEntry.uuid,
    name: workspaceEntry.name,
    auth: toAgentWorkspaceAuthSummary(toAgentWorkspaceAuthRecord(workspaceEntry)),
    repositories: repositoriesByWorkspaceUUID.get(workspaceEntry.uuid) ?? [],
    credentialCount: credentialCountByWorkspaceUUID.get(workspaceEntry.uuid) ?? 0
  }));
}

export async function findAgentWorkspaceByUUID(
  uuid: string,
  teamUUID: string
): Promise<AgentWorkspaceRecord | null> {
  const entry = await getStoredAgentWorkspaceByUUID(uuid, teamUUID);
  return entry ? toAgentWorkspaceRecord(entry) : null;
}

export async function createAgentWorkspace(data: {
  teamUUID: string;
  uuid: string;
  name: string;
  auth: AgentWorkspaceAuthRecord;
}): Promise<AgentWorkspaceRecord> {
  const now = Date.now();
  const entry: StoredAgentWorkspaceEntity = {
    team_uuid: data.teamUUID,
    uuid: data.uuid,
    name: data.name,
    ...toStoredAuthFields(data.auth),
    created_at: now,
    updated_at: now
  };

  await agentWorkspaceStore.set(getAgentWorkspaceKey(data.uuid), entry);
  return toAgentWorkspaceRecord(entry);
}

export async function updateAgentWorkspace(
  uuid: string,
  name: string,
  teamUUID: string
): Promise<AgentWorkspaceRecord | null> {
  const current = await getStoredAgentWorkspaceByUUID(uuid, teamUUID);

  if (!current) {
    return null;
  }

  const next: StoredAgentWorkspaceEntity = {
    ...current,
    name,
    updated_at: Date.now()
  };

  await agentWorkspaceStore.set(getAgentWorkspaceKey(uuid), next);
  return toAgentWorkspaceRecord(next);
}

export async function updateAgentWorkspaceKeys(
  uuid: string,
  keyPair: {
    publicKey: string;
    privateKey: string;
  },
  teamUUID: string
): Promise<AgentWorkspaceRecord | null> {
  const current = await getStoredAgentWorkspaceByUUID(uuid, teamUUID);

  if (!current) {
    return null;
  }

  const next: StoredAgentWorkspaceEntity = {
    ...current,
    ...toStoredAuthFields({
      type: 'ssh',
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    }),
    updated_at: Date.now()
  };

  await agentWorkspaceStore.set(getAgentWorkspaceKey(uuid), next);
  return toAgentWorkspaceRecord(next);
}

export async function updateAgentWorkspaceAuth(
  uuid: string,
  auth: AgentWorkspaceAuthRecord,
  teamUUID: string
): Promise<AgentWorkspaceRecord | null> {
  const current = await getStoredAgentWorkspaceByUUID(uuid, teamUUID);

  if (!current) {
    return null;
  }

  const next: StoredAgentWorkspaceEntity = {
    ...current,
    ...toStoredAuthFields(auth),
    updated_at: Date.now()
  };

  await agentWorkspaceStore.set(getAgentWorkspaceKey(uuid), next);
  return toAgentWorkspaceRecord(next);
}

export async function deleteAgentWorkspace(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const repositories = await listRepositoriesByAgentWorkspaceUUID(uuid, teamUUID);

  await Promise.all(
    repositories.map((repository) =>
      repositoryStore.delete(getRepositoryKey(repository.uuid))
    )
  );
  await agentWorkspaceStore.delete(getAgentWorkspaceKey(uuid));
}

export async function listRepositoriesByAgentWorkspaceUUID(
  agentWorkspaceUUID: string,
  teamUUID: string
): Promise<RepositoryRecord[]> {
  const entries = (
    await repositoryStore.queryByIndexEqualTo(
      AGENT_WORKSPACE_UUID_INDEX_NAME,
      'agent_workspace_uuid',
      agentWorkspaceUUID
    )
  ).filter((entry) => entry.value.team_uuid === teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at)
    .map(toRepositoryRecord);
}

export async function findRepositoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<RepositoryRecord | null> {
  const entry = await getStoredRepositoryByUUID(uuid, teamUUID);
  return entry ? toRepositoryRecord(entry) : null;
}

export async function createRepository(data: {
  teamUUID: string;
  uuid: string;
  agentWorkspaceUUID: string;
  url: string;
}): Promise<RepositoryRecord> {
  const now = Date.now();
  const entry: StoredRepositoryEntity = {
    team_uuid: data.teamUUID,
    uuid: data.uuid,
    agent_workspace_uuid: data.agentWorkspaceUUID,
    url: data.url,
    created_at: now,
    updated_at: now
  };

  await repositoryStore.set(getRepositoryKey(data.uuid), entry);
  return toRepositoryRecord(entry);
}

export async function updateRepository(
  uuid: string,
  url: string,
  teamUUID: string
): Promise<RepositoryRecord | null> {
  const current = await getStoredRepositoryByUUID(uuid, teamUUID);

  if (!current) {
    return null;
  }

  const next: StoredRepositoryEntity = {
    ...current,
    url,
    updated_at: Date.now()
  };

  await repositoryStore.set(getRepositoryKey(uuid), next);
  return toRepositoryRecord(next);
}

export async function deleteRepository(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const current = await getStoredRepositoryByUUID(uuid, teamUUID);

  if (!current) {
    return;
  }

  await repositoryStore.delete(getRepositoryKey(uuid));
}
