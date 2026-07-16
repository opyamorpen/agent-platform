import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { requireAdmin } from '../../lib/web-access.js';
import { knowledgeSourceMutationSchema } from './dto.js';
import {
  createKnowledgeSourceRecord,
  getKnowledgeSources,
  KnowledgeSourceConflictError,
  KnowledgeSourceNotFoundError,
  removeKnowledgeSourceRecord,
  updateKnowledgeSourceRecord
} from './service.js';

function handleError(c: Context, error: unknown) {
  if (error instanceof KnowledgeSourceNotFoundError) {
    return c.json(failure(error.message, 'knowledge_sources.not_found'), 404);
  }
  if (error instanceof KnowledgeSourceConflictError) {
    return c.json(failure(error.message, 'knowledge_sources.conflict'), 409);
  }
  throw error;
}

export async function listKnowledgeSourcesHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getKnowledgeSources(teamUUID)));
}

export async function createKnowledgeSourceHandler(c: Context) {
  const payload = knowledgeSourceMutationSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!payload.success) {
    return c.json(
      failure(
        'Invalid knowledge source payload',
        'knowledge_sources.invalid_payload'
      ),
      400
    );
  }

  try {
    const context = await requireAdmin(c.req);
    return c.json(
      success(await createKnowledgeSourceRecord(payload.data, context)),
      201
    );
  } catch (error) {
    return handleError(c, error);
  }
}

export async function updateKnowledgeSourceHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const payload = knowledgeSourceMutationSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!uuid || !payload.success) {
    return c.json(
      failure(
        'Invalid knowledge source payload',
        'knowledge_sources.invalid_payload'
      ),
      400
    );
  }

  try {
    const context = await requireAdmin(c.req);
    return c.json(
      success(await updateKnowledgeSourceRecord(uuid, payload.data, context))
    );
  } catch (error) {
    return handleError(c, error);
  }
}

export async function deleteKnowledgeSourceHandler(c: Context) {
  const uuid = c.req.param('uuid');
  if (!uuid) {
    return c.json(failure('Knowledge source uuid is required'), 400);
  }

  try {
    const { teamUUID } = await requireAdmin(c.req);
    await removeKnowledgeSourceRecord(uuid, teamUUID);
    return c.json(success({ uuid }));
  } catch (error) {
    return handleError(c, error);
  }
}
