import { randomUUID } from 'node:crypto';
import type {
  KnowledgeSource,
  KnowledgeSourceStatus
} from '@ones-ai-workflow/shared';
import {
  createEntityStore,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'knowledge_source';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const SPACE_UUID_INDEX_NAME = 'idx_space_uuid';
const store = createEntityStore<StoredKnowledgeSource>(ENTITY_NAME);
const NAME_MAX_LENGTH = 128;
const DESCRIPTION_MAX_LENGTH = 512;
const SPACE_NAME_MAX_LENGTH = 256;
const LAST_ERROR_MAX_LENGTH = 512;

interface StoredKnowledgeSource {
  team_uuid: string;
  uuid: string;
  name: string;
  description: string;
  space_uuid: string;
  space_name: string;
  home_page_uuid: string;
  status: KnowledgeSourceStatus;
  last_successful_query_at: number;
  last_error: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function key(uuid: string): string {
  return `knowledge_source_${uuid.replace(/[^a-z0-9]/giu, '').toLowerCase()}`;
}

function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function toRecord(value: StoredKnowledgeSource): KnowledgeSource {
  return {
    uuid: value.uuid,
    name: value.name,
    description: value.description,
    spaceUUID: value.space_uuid,
    spaceName: value.space_name,
    homePageUUID: value.home_page_uuid,
    status: value.status,
    lastSuccessfulQueryAt:
      value.last_successful_query_at > 0
        ? new Date(value.last_successful_query_at).toISOString()
        : null,
    lastError: value.last_error || null,
    createdBy: value.created_by,
    createdAt: new Date(value.created_at).toISOString(),
    updatedAt: new Date(value.updated_at).toISOString()
  };
}

async function listEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredKnowledgeSource>>> {
  return store.queryByIndexEqualTo(TEAM_UUID_INDEX_NAME, 'team_uuid', teamUUID);
}

export async function listKnowledgeSources(
  teamUUID: string
): Promise<KnowledgeSource[]> {
  return (await listEntries(teamUUID))
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at)
    .map(toRecord);
}

export async function findKnowledgeSource(
  uuid: string,
  teamUUID: string
): Promise<KnowledgeSource | null> {
  const value = await store.get(key(uuid));
  return value?.team_uuid === teamUUID ? toRecord(value) : null;
}

export async function findKnowledgeSourcesByUUIDs(
  uuids: string[],
  teamUUID: string
): Promise<KnowledgeSource[]> {
  const records = await Promise.all(
    Array.from(new Set(uuids)).map((uuid) =>
      findKnowledgeSource(uuid, teamUUID)
    )
  );
  return records.filter((record): record is KnowledgeSource => Boolean(record));
}

export async function findKnowledgeSourceBySpaceUUID(
  spaceUUID: string,
  teamUUID: string
): Promise<KnowledgeSource | null> {
  const entries = await store.queryByIndexEqualTo(
    SPACE_UUID_INDEX_NAME,
    'space_uuid',
    spaceUUID
  );
  const value = entries.find(
    (entry) => entry.value.team_uuid === teamUUID
  )?.value;
  return value ? toRecord(value) : null;
}

export async function createKnowledgeSource(input: {
  teamUUID: string;
  name: string;
  description: string;
  spaceUUID: string;
  spaceName: string;
  homePageUUID: string;
  status: KnowledgeSourceStatus;
  createdBy: string;
}): Promise<KnowledgeSource> {
  const now = Date.now();
  const value: StoredKnowledgeSource = {
    team_uuid: input.teamUUID,
    uuid: randomUUID(),
    name: truncate(input.name, NAME_MAX_LENGTH),
    description: truncate(input.description, DESCRIPTION_MAX_LENGTH),
    space_uuid: input.spaceUUID,
    space_name: truncate(input.spaceName, SPACE_NAME_MAX_LENGTH),
    home_page_uuid: input.homePageUUID,
    status: input.status,
    last_successful_query_at: 0,
    last_error: '',
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };

  await store.set(key(value.uuid), value);
  return toRecord(value);
}

export async function updateKnowledgeSource(
  uuid: string,
  teamUUID: string,
  input: {
    name: string;
    description: string;
    spaceUUID: string;
    spaceName: string;
    homePageUUID: string;
    status: KnowledgeSourceStatus;
  }
): Promise<KnowledgeSource | null> {
  const current = await store.get(key(uuid));
  if (!current || current.team_uuid !== teamUUID) {
    return null;
  }

  const value: StoredKnowledgeSource = {
    ...current,
    name: truncate(input.name, NAME_MAX_LENGTH),
    description: truncate(input.description, DESCRIPTION_MAX_LENGTH),
    space_uuid: input.spaceUUID,
    space_name: truncate(input.spaceName, SPACE_NAME_MAX_LENGTH),
    home_page_uuid: input.homePageUUID,
    status: input.status,
    updated_at: Date.now()
  };
  await store.set(key(uuid), value);
  return toRecord(value);
}

export async function updateKnowledgeSourceQueryState(
  uuid: string,
  teamUUID: string,
  input: { success: boolean; error?: string }
): Promise<void> {
  const current = await store.get(key(uuid));
  if (!current || current.team_uuid !== teamUUID) {
    return;
  }

  await store.set(key(uuid), {
    ...current,
    last_successful_query_at: input.success
      ? Date.now()
      : current.last_successful_query_at,
    last_error: input.success
      ? ''
      : truncate(input.error ?? '', LAST_ERROR_MAX_LENGTH),
    updated_at: Date.now()
  });
}

export async function deleteKnowledgeSource(
  uuid: string,
  teamUUID: string
): Promise<boolean> {
  const current = await store.get(key(uuid));
  if (!current || current.team_uuid !== teamUUID) {
    return false;
  }

  await store.delete(key(uuid));
  return true;
}
