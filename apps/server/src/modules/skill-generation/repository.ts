import type {
  SkillGenerationSessionStatus,
  SkillGenerationSessionSummary
} from '@ones-ai-workflow/shared';
import {
  createEntityStore,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'skill_generation_session';
const TEAM_UUID_INDEX = 'idx_team_uuid';
const CREATOR_UUID_INDEX = 'idx_creator_uuid';
const store = createEntityStore<StoredSkillGenerationSession>(ENTITY_NAME);

interface StoredSkillGenerationSession {
  team_uuid: string;
  uuid: string;
  creator_uuid: string;
  title: string;
  status: string;
  revision: number;
  draft_object_key: string;
  published_skill_uuid: string;
  created_at: number;
  updated_at: number;
}

export interface SkillGenerationSessionRecord extends SkillGenerationSessionSummary {
  teamUUID: string;
  creatorUUID: string;
  draftObjectKey: string;
}

function key(uuid: string): string {
  return `sgs_${uuid.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}

function toRecord(
  value: StoredSkillGenerationSession
): SkillGenerationSessionRecord {
  return {
    teamUUID: value.team_uuid,
    uuid: value.uuid,
    creatorUUID: value.creator_uuid,
    title: value.title,
    status: value.status as SkillGenerationSessionStatus,
    revision: value.revision,
    draftObjectKey: value.draft_object_key,
    publishedSkillUUID: value.published_skill_uuid || null,
    createdAt: new Date(value.created_at).toISOString(),
    updatedAt: new Date(value.updated_at).toISOString()
  };
}

export async function createSkillGenerationSessionRecord(input: {
  teamUUID: string;
  uuid: string;
  creatorUUID: string;
  title: string;
  draftObjectKey: string;
}): Promise<SkillGenerationSessionRecord> {
  const now = Date.now();
  const value: StoredSkillGenerationSession = {
    team_uuid: input.teamUUID,
    uuid: input.uuid,
    creator_uuid: input.creatorUUID,
    title: input.title,
    status: 'draft',
    revision: 0,
    draft_object_key: input.draftObjectKey,
    published_skill_uuid: '',
    created_at: now,
    updated_at: now
  };
  await store.set(key(input.uuid), value);
  return toRecord(value);
}

export async function findSkillGenerationSessionRecord(
  uuid: string
): Promise<SkillGenerationSessionRecord | null> {
  const value = await store.get(key(uuid));
  return value ? toRecord(value) : null;
}

export async function listSkillGenerationSessionRecords(input: {
  teamUUID: string;
  creatorUUID: string;
}): Promise<SkillGenerationSessionRecord[]> {
  const entries: Array<HostedEntityEntry<StoredSkillGenerationSession>> =
    await store.queryByIndexEqualTo(
      CREATOR_UUID_INDEX,
      'creator_uuid',
      input.creatorUUID
    );

  return entries
    .map((entry) => entry.value)
    .filter((value) => value.team_uuid === input.teamUUID)
    .sort((left, right) => right.updated_at - left.updated_at)
    .map(toRecord);
}

export async function updateSkillGenerationSessionRecord(
  record: SkillGenerationSessionRecord,
  changes: Partial<{
    title: string;
    status: SkillGenerationSessionStatus;
    revision: number;
    publishedSkillUUID: string;
  }>
): Promise<SkillGenerationSessionRecord> {
  const value: StoredSkillGenerationSession = {
    team_uuid: record.teamUUID,
    uuid: record.uuid,
    creator_uuid: record.creatorUUID,
    title: changes.title ?? record.title,
    status: changes.status ?? record.status,
    revision: changes.revision ?? record.revision,
    draft_object_key: record.draftObjectKey,
    published_skill_uuid:
      changes.publishedSkillUUID ?? record.publishedSkillUUID ?? '',
    created_at: new Date(record.createdAt).getTime(),
    updated_at: Date.now()
  };
  await store.set(key(record.uuid), value);
  return toRecord(value);
}

export async function deleteSkillGenerationSessionRecord(
  uuid: string
): Promise<void> {
  await store.delete(key(uuid));
}

// Keep this export referenced so manifest index changes remain explicit.
export const SKILL_GENERATION_TEAM_INDEX = TEAM_UUID_INDEX;
