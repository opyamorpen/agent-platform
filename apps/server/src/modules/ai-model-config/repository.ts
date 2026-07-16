import type { AIModelConfig } from '@ones-ai-workflow/shared';
import { createEntityStore } from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'ai_model_config';
const store = createEntityStore<StoredAIModelConfig>(ENTITY_NAME);

interface StoredAIModelConfig {
  team_uuid: string;
  provider: string;
  base_url: string;
  model: string;
  temperature: number;
  secret_object_key: string;
  updated_by: string;
  created_at: number;
  updated_at: number;
}

export interface AIModelConfigRecord extends AIModelConfig {
  teamUUID: string;
  secretObjectKey: string;
}

function key(teamUUID: string): string {
  return `aimc_${teamUUID.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}

function toRecord(value: StoredAIModelConfig): AIModelConfigRecord {
  return {
    teamUUID: value.team_uuid,
    provider: 'openai-compatible',
    baseURL: value.base_url,
    model: value.model,
    temperature: value.temperature,
    hasAPIKey: Boolean(value.secret_object_key),
    secretObjectKey: value.secret_object_key,
    updatedBy: value.updated_by || null,
    updatedAt: new Date(value.updated_at).toISOString()
  };
}

export async function findAIModelConfig(
  teamUUID: string
): Promise<AIModelConfigRecord | null> {
  const value = await store.get(key(teamUUID));
  return value?.team_uuid === teamUUID ? toRecord(value) : null;
}

export async function saveAIModelConfig(input: {
  teamUUID: string;
  baseURL: string;
  model: string;
  temperature: number;
  secretObjectKey: string;
  updatedBy: string;
}): Promise<AIModelConfigRecord> {
  const current = await store.get(key(input.teamUUID));
  const now = Date.now();
  const value: StoredAIModelConfig = {
    team_uuid: input.teamUUID,
    provider: 'openai-compatible',
    base_url: input.baseURL,
    model: input.model,
    temperature: input.temperature,
    secret_object_key: input.secretObjectKey,
    updated_by: input.updatedBy,
    created_at: current?.created_at ?? now,
    updated_at: now
  };

  await store.set(key(input.teamUUID), value);
  return toRecord(value);
}
