import type { LoopRuntimeConfig } from '@ones-ai-workflow/shared';
import { createEntityStore } from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'loop_runtime_config';
const store = createEntityStore<StoredLoopRuntimeConfig>(ENTITY_NAME);

interface StoredLoopRuntimeConfig {
  team_uuid: string;
  enabled: boolean;
  updated_by: string;
  created_at: number;
  updated_at: number;
}

function key(teamUUID: string): string {
  return `lrc_${teamUUID.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}

function toConfig(value: StoredLoopRuntimeConfig): LoopRuntimeConfig {
  return {
    enabled: value.enabled,
    updatedBy: value.updated_by || null,
    updatedAt: new Date(value.updated_at).toISOString()
  };
}

export async function findLoopRuntimeConfig(
  teamUUID: string
): Promise<LoopRuntimeConfig | null> {
  const value = await store.get(key(teamUUID));
  return value?.team_uuid === teamUUID ? toConfig(value) : null;
}

export async function saveLoopRuntimeConfig(input: {
  teamUUID: string;
  enabled: boolean;
  updatedBy: string;
}): Promise<LoopRuntimeConfig> {
  const current = await store.get(key(input.teamUUID));
  const now = Date.now();
  const value: StoredLoopRuntimeConfig = {
    team_uuid: input.teamUUID,
    enabled: input.enabled,
    updated_by: input.updatedBy,
    created_at: current?.created_at ?? now,
    updated_at: now
  };

  await store.set(key(input.teamUUID), value);
  return toConfig(value);
}
