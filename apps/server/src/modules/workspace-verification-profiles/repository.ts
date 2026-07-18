import type {
  WorkspaceVerificationProfile,
  WorkspaceVerificationStep
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  deleteObject,
  readObjectJson,
  uploadObjectJson,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'workspace_verification_profile';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const WORKSPACE_UUID_INDEX_NAME = 'idx_workspace_uuid';
const store = createEntityStore<StoredWorkspaceVerificationProfile>(ENTITY_NAME);

interface StoredWorkspaceVerificationProfile {
  team_uuid: string;
  uuid: string;
  workspace_uuid: string;
  workspace_name: string;
  name: string;
  steps_object_key: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function key(uuid: string): string {
  return `workspace_verification_profile_${uuid.replace(/[^a-z0-9]/giu, '').toLowerCase()}`;
}

function stepsObjectKey(
  teamUUID: string,
  uuid: string,
  revision: number
): string {
  return buildHostedObjectKey(
    'workspace-verification-profile',
    teamUUID,
    uuid,
    `steps-${revision}.json`
  );
}

async function toProfile(
  value: StoredWorkspaceVerificationProfile
): Promise<WorkspaceVerificationProfile> {
  return {
    uuid: value.uuid,
    workspaceUUID: value.workspace_uuid,
    workspaceName: value.workspace_name,
    name: value.name,
    steps:
      (await readObjectJson<WorkspaceVerificationStep[]>(
        value.steps_object_key
      )) ?? [],
    createdBy: value.created_by,
    createdAt: new Date(value.created_at).toISOString(),
    updatedAt: new Date(value.updated_at).toISOString()
  };
}

async function listEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredWorkspaceVerificationProfile>>> {
  return store.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

export async function listWorkspaceVerificationProfiles(
  teamUUID: string
): Promise<WorkspaceVerificationProfile[]> {
  const profiles = await Promise.all(
    (await listEntries(teamUUID)).map((entry) => toProfile(entry.value))
  );
  return profiles.sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function listWorkspaceVerificationProfilesByWorkspaceUUID(
  workspaceUUID: string,
  teamUUID: string
): Promise<WorkspaceVerificationProfile[]> {
  const entries = await store.queryByIndexEqualTo(
    WORKSPACE_UUID_INDEX_NAME,
    'workspace_uuid',
    workspaceUUID
  );
  const profiles = await Promise.all(
    entries
      .filter((entry) => entry.value.team_uuid === teamUUID)
      .map((entry) => toProfile(entry.value))
  );
  return profiles.sort((left, right) => left.name.localeCompare(right.name));
}

export async function findWorkspaceVerificationProfile(
  uuid: string,
  teamUUID: string
): Promise<WorkspaceVerificationProfile | null> {
  const value = await store.get(key(uuid));
  return value?.team_uuid === teamUUID ? toProfile(value) : null;
}

export async function findWorkspaceVerificationProfilesByUUIDs(
  uuids: string[],
  teamUUID: string
): Promise<WorkspaceVerificationProfile[]> {
  const profiles = await Promise.all(
    Array.from(new Set(uuids)).map((uuid) =>
      findWorkspaceVerificationProfile(uuid, teamUUID)
    )
  );
  return profiles.filter(
    (profile): profile is WorkspaceVerificationProfile => Boolean(profile)
  );
}

export async function createWorkspaceVerificationProfile(input: {
  teamUUID: string;
  uuid: string;
  workspaceUUID: string;
  workspaceName: string;
  name: string;
  steps: WorkspaceVerificationStep[];
  createdBy: string;
}): Promise<WorkspaceVerificationProfile> {
  const now = Date.now();
  const objectKey = stepsObjectKey(input.teamUUID, input.uuid, now);
  const value: StoredWorkspaceVerificationProfile = {
    team_uuid: input.teamUUID,
    uuid: input.uuid,
    workspace_uuid: input.workspaceUUID,
    workspace_name: input.workspaceName,
    name: input.name,
    steps_object_key: objectKey,
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };
  await uploadObjectJson(objectKey, input.steps);
  await store.set(key(input.uuid), value);
  return toProfile(value);
}

export async function updateWorkspaceVerificationProfile(
  uuid: string,
  teamUUID: string,
  input: {
    workspaceUUID: string;
    workspaceName: string;
    name: string;
    steps: WorkspaceVerificationStep[];
  }
): Promise<WorkspaceVerificationProfile | null> {
  const current = await store.get(key(uuid));
  if (!current || current.team_uuid !== teamUUID) {
    return null;
  }
  const updatedAt = Date.now();
  const nextStepsObjectKey = stepsObjectKey(teamUUID, uuid, updatedAt);
  await uploadObjectJson(nextStepsObjectKey, input.steps);
  const next: StoredWorkspaceVerificationProfile = {
    ...current,
    workspace_uuid: input.workspaceUUID,
    workspace_name: input.workspaceName,
    name: input.name,
    steps_object_key: nextStepsObjectKey,
    updated_at: updatedAt
  };
  await store.set(key(uuid), next);
  await deleteObject(current.steps_object_key).catch(() => undefined);
  return toProfile(next);
}

export async function deleteWorkspaceVerificationProfile(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const current = await store.get(key(uuid));
  if (!current || current.team_uuid !== teamUUID) {
    return;
  }
  await Promise.all([
    store.delete(key(uuid)),
    deleteObject(current.steps_object_key).catch(() => undefined)
  ]);
}
