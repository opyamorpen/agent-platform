import type { ModelProfile } from '@ones-ai-workflow/shared';
import { createEntityStore, type HostedEntityEntry } from '../../lib/hosted-storage.js';
import type { ModelProfileMutationDTO } from './dto.js';

const MODEL_PROFILE_ENTITY_NAME = 'model_profile';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';

const modelProfileStore =
  createEntityStore<StoredModelProfileEntity>(MODEL_PROFILE_ENTITY_NAME);

interface StoredModelProfileEntity {
  team_uuid: string;
  uuid: string;
  name: string;
  provider: string;
  model: string;
  base_url: string;
  api_key_secret_name: string;
  reasoning_effort: string;
  temperature: number;
  is_default: boolean;
  created_at: number;
  updated_at: number;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getModelProfileKey(uuid: string): string {
  return `model_profile_${normalizeKeySegment(uuid)}`;
}

function nullableString(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim();
  return normalized ? normalized : null;
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function toModelProfile(entry: StoredModelProfileEntity): ModelProfile {
  return {
    uuid: entry.uuid,
    name: entry.name,
    provider: entry.provider,
    model: entry.model,
    baseURL: nullableString(entry.base_url),
    apiKeySecretName: nullableString(entry.api_key_secret_name),
    reasoningEffort: nullableString(entry.reasoning_effort),
    temperature: nullableNumber(entry.temperature),
    isDefault: entry.is_default,
    createdAt: new Date(entry.created_at).toISOString(),
    updatedAt: new Date(entry.updated_at).toISOString()
  };
}

async function listTeamEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredModelProfileEntity>>> {
  return modelProfileStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function unsetOtherDefaultProfiles(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const entries = await listTeamEntries(teamUUID);
  await Promise.all(
    entries
      .map((entry) => entry.value)
      .filter((profile) => profile.uuid !== uuid && profile.is_default)
      .map((profile) =>
        modelProfileStore.set(getModelProfileKey(profile.uuid), {
          ...profile,
          is_default: false,
          updated_at: Date.now()
        })
      )
  );
}

export async function listModelProfiles(teamUUID: string): Promise<ModelProfile[]> {
  const entries = await listTeamEntries(teamUUID);
  return entries
    .map((entry) => entry.value)
    .sort((left, right) => Number(right.is_default) - Number(left.is_default) || left.created_at - right.created_at)
    .map(toModelProfile);
}

export async function findModelProfileByUUID(
  uuid: string,
  teamUUID: string
): Promise<ModelProfile | null> {
  const entry = await modelProfileStore.get(getModelProfileKey(uuid));

  if (!entry || entry.team_uuid !== teamUUID) {
    return null;
  }

  return toModelProfile(entry);
}

export async function createModelProfile(
  uuid: string,
  data: ModelProfileMutationDTO,
  teamUUID: string
): Promise<ModelProfile> {
  const now = Date.now();
  const entry: StoredModelProfileEntity = {
    team_uuid: teamUUID,
    uuid,
    name: data.name,
    provider: data.provider,
    model: data.model,
    base_url: data.baseURL ?? '',
    api_key_secret_name: data.apiKeySecretName ?? '',
    reasoning_effort: data.reasoningEffort ?? '',
    temperature: data.temperature ?? -1,
    is_default: Boolean(data.isDefault),
    created_at: now,
    updated_at: now
  };

  if (entry.is_default) {
    await unsetOtherDefaultProfiles(uuid, teamUUID);
  }

  await modelProfileStore.set(getModelProfileKey(uuid), entry);
  return toModelProfile(entry);
}

export async function updateModelProfile(
  uuid: string,
  data: ModelProfileMutationDTO,
  teamUUID: string
): Promise<ModelProfile | null> {
  const current = await modelProfileStore.get(getModelProfileKey(uuid));

  if (!current || current.team_uuid !== teamUUID) {
    return null;
  }

  const next: StoredModelProfileEntity = {
    ...current,
    name: data.name,
    provider: data.provider,
    model: data.model,
    base_url: data.baseURL ?? '',
    api_key_secret_name: data.apiKeySecretName ?? '',
    reasoning_effort: data.reasoningEffort ?? '',
    temperature: data.temperature ?? -1,
    is_default: Boolean(data.isDefault),
    updated_at: Date.now()
  };

  if (next.is_default) {
    await unsetOtherDefaultProfiles(uuid, teamUUID);
  }

  await modelProfileStore.set(getModelProfileKey(uuid), next);
  return toModelProfile(next);
}

export async function deleteModelProfile(uuid: string, teamUUID: string): Promise<void> {
  const current = await modelProfileStore.get(getModelProfileKey(uuid));

  if (!current || current.team_uuid !== teamUUID) {
    return;
  }

  await modelProfileStore.delete(getModelProfileKey(uuid));
}
