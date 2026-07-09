import {
  createEntityStore,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';

const APP_MEMBER_ENTITY_NAME = 'app_member';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';

const appMemberStore = createEntityStore<StoredAppMemberEntity>(APP_MEMBER_ENTITY_NAME);

export interface AppMemberRecord {
  teamUUID: string;
  userUUID: string;
  name: string;
  email: string | null;
  staffID: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredAppMemberEntity {
  team_uuid: string;
  user_uuid: string;
  name: string;
  email: string;
  staff_id: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getAppMemberKey(teamUUID: string, userUUID: string): string {
  return `app_member_${normalizeKeySegment(teamUUID)}_${normalizeKeySegment(userUUID)}`;
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toAppMemberRecord(entity: StoredAppMemberEntity): AppMemberRecord {
  return {
    teamUUID: entity.team_uuid,
    userUUID: entity.user_uuid,
    name: entity.name,
    email: normalizeOptionalText(entity.email),
    staffID: normalizeOptionalText(entity.staff_id),
    createdBy: entity.created_by,
    createdAt: new Date(entity.created_at),
    updatedAt: new Date(entity.updated_at)
  };
}

async function getStoredAppMember(
  teamUUID: string,
  userUUID: string
): Promise<StoredAppMemberEntity | null> {
  const entity = await appMemberStore.get(getAppMemberKey(teamUUID, userUUID));
  return entity?.team_uuid === teamUUID ? entity : null;
}

async function listTeamAppMemberEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAppMemberEntity>>> {
  return appMemberStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

export async function findAppMemberByUserUUID(
  teamUUID: string,
  userUUID: string
): Promise<AppMemberRecord | null> {
  const entity = await getStoredAppMember(teamUUID, userUUID);
  return entity ? toAppMemberRecord(entity) : null;
}

export async function listAppMembers(teamUUID: string): Promise<AppMemberRecord[]> {
  const entries = await listTeamAppMemberEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => {
      if (left.created_at !== right.created_at) {
        return left.created_at - right.created_at;
      }

      return left.name.localeCompare(right.name, 'zh-CN');
    })
    .map(toAppMemberRecord);
}

export async function addAppMember(input: {
  teamUUID: string;
  userUUID: string;
  name: string;
  email?: string | null;
  staffID?: string | null;
  createdBy: string;
}): Promise<AppMemberRecord> {
  const now = Date.now();
  const nextEntity: StoredAppMemberEntity = {
    team_uuid: input.teamUUID,
    user_uuid: input.userUUID,
    name: input.name,
    email: input.email?.trim() ?? '',
    staff_id: input.staffID?.trim() ?? '',
    created_by: input.createdBy,
    created_at: now,
    updated_at: now
  };

  await appMemberStore.set(
    getAppMemberKey(input.teamUUID, input.userUUID),
    nextEntity
  );

  return toAppMemberRecord(nextEntity);
}

export async function deleteAppMember(
  teamUUID: string,
  userUUID: string
): Promise<void> {
  await appMemberStore.delete(getAppMemberKey(teamUUID, userUUID));
}
