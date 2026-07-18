import type { LoopRuntimeConfig } from '@ones-ai-workflow/shared';
import type { UpdateLoopRuntimeConfigDTO } from './dto.js';
import { findLoopRuntimeConfig, saveLoopRuntimeConfig } from './repository.js';

const DEFAULT_CONFIG: LoopRuntimeConfig = {
  enabled: false,
  updatedBy: null,
  updatedAt: null
};

export async function getLoopRuntimeConfig(
  teamUUID: string
): Promise<LoopRuntimeConfig> {
  return (await findLoopRuntimeConfig(teamUUID)) ?? DEFAULT_CONFIG;
}

export async function isLoopRuntimeEnabled(teamUUID: string): Promise<boolean> {
  return (await findLoopRuntimeConfig(teamUUID))?.enabled === true;
}

export async function updateLoopRuntimeConfig(
  payload: UpdateLoopRuntimeConfigDTO,
  teamUUID: string,
  userUUID: string
): Promise<LoopRuntimeConfig> {
  return saveLoopRuntimeConfig({
    teamUUID,
    enabled: payload.enabled,
    updatedBy: userUUID
  });
}
