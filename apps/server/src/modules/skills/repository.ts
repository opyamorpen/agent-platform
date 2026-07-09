import { createEntityStore, type HostedEntityEntry } from '../../lib/hosted-storage.js';

const SKILL_ENTITY_NAME = 'skill';
const SKILL_VERSION_ENTITY_NAME = 'skill_version';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const SKILL_UUID_INDEX_NAME = 'idx_skill_uuid';

const skillStore = createEntityStore<StoredSkillEntity>(SKILL_ENTITY_NAME);
const skillVersionStore =
  createEntityStore<StoredSkillVersionEntity>(SKILL_VERSION_ENTITY_NAME);

export interface SkillRecord {
  uuid: string;
  name: string;
  description: string;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillVersionRecord {
  uuid: string;
  skillUUID: string;
  version: number;
  storagePath: string;
  fileCount: number;
  createdAt: Date;
}

interface StoredSkillEntity {
  team_uuid: string;
  uuid: string;
  name: string;
  description: string;
  current_version: number;
  created_at: number;
  updated_at: number;
}

interface StoredSkillVersionEntity {
  team_uuid: string;
  uuid: string;
  skill_uuid: string;
  version: number;
  storage_path: string;
  file_count: number;
  created_at: number;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getSkillKey(uuid: string): string {
  return `skill_${normalizeKeySegment(uuid)}`;
}

function getSkillVersionKey(skillUUID: string, version: number): string {
  return `skill_version_${normalizeKeySegment(skillUUID)}_${version}`;
}

function toSkillRecord(entry: StoredSkillEntity): SkillRecord {
  return {
    uuid: entry.uuid,
    name: entry.name,
    description: entry.description,
    currentVersion: entry.current_version,
    createdAt: new Date(entry.created_at),
    updatedAt: new Date(entry.updated_at)
  };
}

function toSkillVersionRecord(entry: StoredSkillVersionEntity): SkillVersionRecord {
  return {
    uuid: entry.uuid,
    skillUUID: entry.skill_uuid,
    version: entry.version,
    storagePath: entry.storage_path,
    fileCount: entry.file_count,
    createdAt: new Date(entry.created_at)
  };
}

async function listSkillEntries(
  teamUUID?: string
): Promise<Array<HostedEntityEntry<StoredSkillEntity>>> {
  if (!teamUUID) {
    return skillStore.getMany();
  }

  return skillStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listSkillVersionEntriesBySkillUUID(
  skillUUID: string,
  teamUUID?: string
): Promise<Array<HostedEntityEntry<StoredSkillVersionEntity>>> {
  const entries = await skillVersionStore.queryByIndexEqualTo(
    SKILL_UUID_INDEX_NAME,
    'skill_uuid',
    skillUUID
  );

  return typeof teamUUID === 'string'
    ? entries.filter((entry) => entry.value.team_uuid === teamUUID)
    : entries;
}

async function getStoredSkillByUUID(
  uuid: string,
  teamUUID?: string
): Promise<StoredSkillEntity | null> {
  const entry = (await skillStore.get(getSkillKey(uuid))) ?? null;

  if (!entry) {
    return null;
  }

  if (teamUUID && entry.team_uuid !== teamUUID) {
    return null;
  }

  return entry;
}

export async function listSkills(teamUUID: string): Promise<SkillRecord[]> {
  const entries = await listSkillEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => right.updated_at - left.updated_at)
    .map(toSkillRecord);
}

export async function listAllSkills(): Promise<SkillRecord[]> {
  const entries = await listSkillEntries();

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => right.updated_at - left.updated_at)
    .map(toSkillRecord);
}

export async function findSkillByUUID(
  uuid: string,
  teamUUID: string
): Promise<SkillRecord | null> {
  const entry = await getStoredSkillByUUID(uuid, teamUUID);
  return entry ? toSkillRecord(entry) : null;
}

export async function findSkillsByUUIDs(
  uuids: string[],
  teamUUID: string
): Promise<SkillRecord[]> {
  if (uuids.length === 0) {
    return [];
  }

  const records = await Promise.all(
    uuids.map((uuid) => getStoredSkillByUUID(uuid, teamUUID))
  );

  return records.flatMap((record) => (record ? [toSkillRecord(record)] : []));
}

export async function findSkillByUUIDAcrossTeams(
  uuid: string
): Promise<SkillRecord | null> {
  const entry = await getStoredSkillByUUID(uuid);
  return entry ? toSkillRecord(entry) : null;
}

export async function findSkillByName(
  name: string,
  teamUUID: string
): Promise<SkillRecord | null> {
  const entries = await listSkillEntries(teamUUID);
  const normalized = name.trim();
  const entry = entries.find((item) => item.value.name === normalized)?.value;
  return entry ? toSkillRecord(entry) : null;
}

export async function findSkillVersion(
  skillUUID: string,
  version: number,
  teamUUID: string
): Promise<SkillVersionRecord | null> {
  const entry = await skillVersionStore.get(getSkillVersionKey(skillUUID, version));

  if (!entry || entry.team_uuid !== teamUUID) {
    return null;
  }

  return toSkillVersionRecord(entry);
}

export async function findSkillVersionAcrossTeams(
  skillUUID: string,
  version: number
): Promise<SkillVersionRecord | null> {
  const entry = await skillVersionStore.get(getSkillVersionKey(skillUUID, version));
  return entry ? toSkillVersionRecord(entry) : null;
}

export async function listSkillVersionsBySkillUUID(
  skillUUID: string,
  teamUUID: string
): Promise<SkillVersionRecord[]> {
  const entries = await listSkillVersionEntriesBySkillUUID(skillUUID, teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => right.version - left.version)
    .map(toSkillVersionRecord);
}

export async function createSkill(data: {
  teamUUID: string;
  uuid: string;
  name: string;
  description: string;
  currentVersion: number;
}): Promise<SkillRecord> {
  const now = Date.now();
  const entry: StoredSkillEntity = {
    team_uuid: data.teamUUID,
    uuid: data.uuid,
    name: data.name,
    description: data.description,
    current_version: data.currentVersion,
    created_at: now,
    updated_at: now
  };

  await skillStore.set(getSkillKey(data.uuid), entry);
  return toSkillRecord(entry);
}

export async function updateSkill(
  uuid: string,
  data: {
    name: string;
    description: string;
    currentVersion?: number;
  },
  teamUUID: string
): Promise<SkillRecord | null> {
  const current = await getStoredSkillByUUID(uuid, teamUUID);

  if (!current) {
    return null;
  }

  const next: StoredSkillEntity = {
    ...current,
    name: data.name,
    description: data.description,
    current_version: data.currentVersion ?? current.current_version,
    updated_at: Date.now()
  };

  await skillStore.set(getSkillKey(uuid), next);
  return toSkillRecord(next);
}

export async function createSkillVersion(data: {
  teamUUID: string;
  uuid: string;
  skillUUID: string;
  version: number;
  storagePath: string;
  fileCount: number;
}): Promise<SkillVersionRecord> {
  const entry: StoredSkillVersionEntity = {
    team_uuid: data.teamUUID,
    uuid: data.uuid,
    skill_uuid: data.skillUUID,
    version: data.version,
    storage_path: data.storagePath,
    file_count: data.fileCount,
    created_at: Date.now()
  };

  await skillVersionStore.set(
    getSkillVersionKey(data.skillUUID, data.version),
    entry
  );
  return toSkillVersionRecord(entry);
}

export async function deleteSkillVersionBySkillUUID(
  skillUUID: string,
  teamUUID: string
): Promise<void> {
  const versions = await listSkillVersionsBySkillUUID(skillUUID, teamUUID);

  await Promise.all(
    versions.map((version) =>
      skillVersionStore.delete(getSkillVersionKey(version.skillUUID, version.version))
    )
  );
}

export async function deleteSkillByUUID(uuid: string, teamUUID: string): Promise<void> {
  const current = await getStoredSkillByUUID(uuid, teamUUID);

  if (!current) {
    return;
  }

  await skillStore.delete(getSkillKey(uuid));
}
