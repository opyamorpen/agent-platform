import { randomUUID } from 'node:crypto';
import {
  createModelProfile,
  deleteModelProfile,
  findModelProfileByUUID,
  listModelProfiles,
  updateModelProfile
} from './repository.js';
import type { ModelProfileMutationDTO } from './dto.js';

export class ModelProfileNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Model profile not found: ${uuid}`);
    this.name = 'ModelProfileNotFoundError';
  }
}

export async function getModelProfileSummaries(teamUUID: string) {
  return listModelProfiles(teamUUID);
}

export async function createModelProfileRecord(
  data: ModelProfileMutationDTO,
  teamUUID: string
) {
  return createModelProfile(randomUUID(), data, teamUUID);
}

export async function updateModelProfileRecord(
  uuid: string,
  data: ModelProfileMutationDTO,
  teamUUID: string
) {
  const updated = await updateModelProfile(uuid, data, teamUUID);

  if (!updated) {
    throw new ModelProfileNotFoundError(uuid);
  }

  return updated;
}

export async function removeModelProfileRecord(uuid: string, teamUUID: string) {
  const current = await findModelProfileByUUID(uuid, teamUUID);

  if (!current) {
    throw new ModelProfileNotFoundError(uuid);
  }

  await deleteModelProfile(uuid, teamUUID);
}
