import { createHash } from 'node:crypto';
import type { AgentWorkspaceCredential } from '@ones-ai-workflow/shared';
import {
  createEntityStore,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';

const WORKSPACE_CREDENTIAL_ENTITY_NAME = 'workspace_credential';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const AGENT_WORKSPACE_UUID_INDEX_NAME = 'idx_agent_workspace_uuid';

const workspaceCredentialStore =
  createEntityStore<StoredWorkspaceCredentialEntity>(
    WORKSPACE_CREDENTIAL_ENTITY_NAME
  );

interface StoredWorkspaceCredentialEntity {
  team_uuid: string;
  agent_workspace_uuid: string;
  env_name: string;
  description: string;
  secret_object_key: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface WorkspaceCredentialRecord extends AgentWorkspaceCredential {
  teamUUID: string;
  agentWorkspaceUUID: string;
  secretObjectKey: string;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getWorkspaceCredentialKey(
  teamUUID: string,
  agentWorkspaceUUID: string,
  envName: string
): string {
  const digest = createHash('sha256')
    .update(
      [
        normalizeKeySegment(teamUUID),
        normalizeKeySegment(agentWorkspaceUUID),
        normalizeKeySegment(envName)
      ].join(':')
    )
    .digest('hex');

  return `wsc_${digest.slice(0, 40)}`;
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toWorkspaceCredentialRecord(
  entity: StoredWorkspaceCredentialEntity
): WorkspaceCredentialRecord {
  return {
    teamUUID: entity.team_uuid,
    agentWorkspaceUUID: entity.agent_workspace_uuid,
    envName: entity.env_name,
    description: normalizeOptionalText(entity.description),
    secretObjectKey: entity.secret_object_key,
    createdBy: entity.created_by,
    createdAt: new Date(entity.created_at).toISOString(),
    updatedAt: new Date(entity.updated_at).toISOString()
  };
}

async function getStoredWorkspaceCredential(
  teamUUID: string,
  agentWorkspaceUUID: string,
  envName: string
): Promise<StoredWorkspaceCredentialEntity | null> {
  const entity = await workspaceCredentialStore.get(
    getWorkspaceCredentialKey(teamUUID, agentWorkspaceUUID, envName)
  );

  return entity?.team_uuid === teamUUID &&
    entity.agent_workspace_uuid === agentWorkspaceUUID
    ? entity
    : null;
}

async function listWorkspaceCredentialEntriesByWorkspace(
  agentWorkspaceUUID: string
): Promise<Array<HostedEntityEntry<StoredWorkspaceCredentialEntity>>> {
  return workspaceCredentialStore.queryByIndexEqualTo(
    AGENT_WORKSPACE_UUID_INDEX_NAME,
    'agent_workspace_uuid',
    agentWorkspaceUUID
  );
}

export async function listWorkspaceCredentialsByWorkspaceUUID(
  agentWorkspaceUUID: string,
  teamUUID: string
): Promise<WorkspaceCredentialRecord[]> {
  const entries = (
    await listWorkspaceCredentialEntriesByWorkspace(agentWorkspaceUUID)
  ).filter((entry) => entry.value.team_uuid === teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => left.env_name.localeCompare(right.env_name))
    .map(toWorkspaceCredentialRecord);
}

export async function findWorkspaceCredentialByEnvName(
  agentWorkspaceUUID: string,
  envName: string,
  teamUUID: string
): Promise<WorkspaceCredentialRecord | null> {
  const entity = await getStoredWorkspaceCredential(teamUUID, agentWorkspaceUUID, envName);
  return entity ? toWorkspaceCredentialRecord(entity) : null;
}

export async function saveWorkspaceCredential(input: {
  teamUUID: string;
  agentWorkspaceUUID: string;
  envName: string;
  description?: string | null;
  secretObjectKey: string;
  createdBy: string;
}): Promise<WorkspaceCredentialRecord> {
  const current = await getStoredWorkspaceCredential(
    input.teamUUID,
    input.agentWorkspaceUUID,
    input.envName
  );
  const now = Date.now();
  const nextEntity: StoredWorkspaceCredentialEntity = {
    team_uuid: input.teamUUID,
    agent_workspace_uuid: input.agentWorkspaceUUID,
    env_name: input.envName,
    description: input.description?.trim() ?? '',
    secret_object_key: input.secretObjectKey,
    created_by: current?.created_by ?? input.createdBy,
    created_at: current?.created_at ?? now,
    updated_at: now
  };

  await workspaceCredentialStore.set(
    getWorkspaceCredentialKey(
      input.teamUUID,
      input.agentWorkspaceUUID,
      input.envName
    ),
    nextEntity
  );

  return toWorkspaceCredentialRecord(nextEntity);
}

export async function deleteWorkspaceCredential(
  agentWorkspaceUUID: string,
  envName: string,
  teamUUID: string
): Promise<void> {
  const current = await getStoredWorkspaceCredential(teamUUID, agentWorkspaceUUID, envName);

  if (!current) {
    return;
  }

  await workspaceCredentialStore.delete(
    getWorkspaceCredentialKey(teamUUID, agentWorkspaceUUID, envName)
  );
}

export async function listWorkspaceCredentialsByTeamUUID(
  teamUUID: string
): Promise<WorkspaceCredentialRecord[]> {
  const entries = await workspaceCredentialStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );

  return entries.map((entry) => toWorkspaceCredentialRecord(entry.value));
}

export async function countWorkspaceCredentialsByWorkspaceUUID(
  agentWorkspaceUUID: string,
  teamUUID: string
): Promise<number> {
  const entries = await listWorkspaceCredentialEntriesByWorkspace(agentWorkspaceUUID);

  return entries.filter((entry) => entry.value.team_uuid === teamUUID).length;
}
