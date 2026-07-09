import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { modelProfileMutationSchema } from './dto.js';
import {
  createModelProfileRecord,
  getModelProfileSummaries,
  ModelProfileNotFoundError,
  removeModelProfileRecord,
  updateModelProfileRecord
} from './service.js';

export async function listModelProfilesHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getModelProfileSummaries(teamUUID)));
}

export async function createModelProfileHandler(c: Context) {
  const payload = modelProfileMutationSchema.safeParse(await c.req.json().catch(() => null));

  if (!payload.success) {
    return c.json(failure('Invalid model profile payload', 'model_profiles.invalid_payload'), 400);
  }

  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await createModelProfileRecord(payload.data, teamUUID)), 201);
}

export async function updateModelProfileHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const payload = modelProfileMutationSchema.safeParse(await c.req.json().catch(() => null));

  if (!uuid) {
    return c.json(failure('Model profile uuid is required', 'model_profiles.uuid_required'), 400);
  }

  if (!payload.success) {
    return c.json(failure('Invalid model profile payload', 'model_profiles.invalid_payload'), 400);
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await updateModelProfileRecord(uuid, payload.data, teamUUID)));
  } catch (error) {
    if (error instanceof ModelProfileNotFoundError) {
      return c.json(failure(error.message, 'model_profiles.not_found'), 404);
    }

    throw error;
  }
}

export async function deleteModelProfileHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(failure('Model profile uuid is required', 'model_profiles.uuid_required'), 400);
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeModelProfileRecord(uuid, teamUUID);
    return c.json(success(true));
  } catch (error) {
    if (error instanceof ModelProfileNotFoundError) {
      return c.json(failure(error.message, 'model_profiles.not_found'), 404);
    }

    throw error;
  }
}
