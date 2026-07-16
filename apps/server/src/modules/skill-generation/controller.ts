import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { streamAIEvents } from '../../lib/sse.js';
import { getWebSession } from '../../lib/web-session.js';
import { SkillConflictError } from '../skills/service.js';
import {
  addSkillGenerationMessageSchema,
  createSkillGenerationSessionSchema,
  generateSkillDraftSchema,
  publishSkillGenerationSessionSchema,
  updateSkillGenerationDraftSchema
} from './dto.js';
import {
  createSkillGenerationSession,
  deleteOwnSkillGenerationSession,
  generateSkillDraft,
  getOwnSkillGenerationSession,
  listOwnSkillGenerationSessions,
  publishGeneratedSkill,
  SkillGenerationBusyError,
  SkillGenerationRevisionConflictError,
  SkillGenerationScriptReviewRequiredError,
  SkillGenerationSessionNotFoundError,
  streamSkillGenerationConversation,
  updateOwnSkillGenerationDraft
} from './service.js';
import { InvalidGeneratedSkillError } from './validation.js';

export async function createSkillGenerationSessionHandler(c: Context) {
  const result = createSkillGenerationSessionSchema.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!result.success) {
    return c.json(
      failure(
        'Invalid Skill generation session payload',
        'skill_generation.invalid_payload'
      ),
      400
    );
  }
  const { teamUUID, userUUID } = await getWebSession(c.req);
  return c.json(
    success(
      await createSkillGenerationSession({
        teamUUID,
        creatorUUID: userUUID,
        ...result.data
      })
    ),
    201
  );
}

export async function listSkillGenerationSessionsHandler(c: Context) {
  const { teamUUID, userUUID } = await getWebSession(c.req);
  return c.json(
    success(
      await listOwnSkillGenerationSessions({ teamUUID, creatorUUID: userUUID })
    )
  );
}

export async function getSkillGenerationSessionHandler(c: Context) {
  try {
    const { teamUUID, userUUID } = await getWebSession(c.req);
    return c.json(
      success(
        await getOwnSkillGenerationSession({
          uuid: c.req.param('uuid') ?? '',
          teamUUID,
          creatorUUID: userUUID
        })
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function deleteSkillGenerationSessionHandler(c: Context) {
  try {
    const { teamUUID, userUUID } = await getWebSession(c.req);
    await deleteOwnSkillGenerationSession({
      uuid: c.req.param('uuid') ?? '',
      teamUUID,
      creatorUUID: userUUID
    });
    return c.json(success(true));
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function streamSkillGenerationMessageHandler(c: Context) {
  const result = addSkillGenerationMessageSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!result.success) {
    return c.json(
      failure(
        'Invalid Skill generation message',
        'skill_generation.invalid_message'
      ),
      400
    );
  }
  const { teamUUID, userUUID } = await getWebSession(c.req);

  return streamAIEvents(c, async ({ signal, send }) => {
    await send('meta', { requestUUID: randomUUID() });
    await send('stage', { stage: 'thinking' });
    const session = await streamSkillGenerationConversation({
      uuid: c.req.param('uuid') ?? '',
      teamUUID,
      creatorUUID: userUUID,
      message: result.data.message,
      signal,
      onDelta: (delta) => send('text_delta', { delta })
    });
    await send('done', { session });
  });
}

export async function streamGenerateSkillDraftHandler(c: Context) {
  const result = generateSkillDraftSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!result.success) {
    return c.json(
      failure(
        'Invalid Skill generation request',
        'skill_generation.invalid_generate_payload'
      ),
      400
    );
  }
  const { teamUUID, userUUID } = await getWebSession(c.req);

  return streamAIEvents(c, async ({ signal, send }) => {
    await send('meta', { requestUUID: randomUUID() });
    const session = await generateSkillDraft({
      uuid: c.req.param('uuid') ?? '',
      teamUUID,
      creatorUUID: userUUID,
      expectedRevision: result.data.expectedRevision,
      signal,
      onStage: (stage) => send('stage', { stage })
    });
    await send('draft_ready', { session });
    await send('done', { session });
  });
}

export async function updateSkillGenerationDraftHandler(c: Context) {
  const result = updateSkillGenerationDraftSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!result.success) {
    return c.json(
      failure(
        'Invalid Skill draft payload',
        'skill_generation.invalid_draft_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID, userUUID } = await getWebSession(c.req);
    return c.json(
      success(
        await updateOwnSkillGenerationDraft({
          uuid: c.req.param('uuid') ?? '',
          teamUUID,
          creatorUUID: userUUID,
          ...result.data
        })
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function publishSkillGenerationSessionHandler(c: Context) {
  const result = publishSkillGenerationSessionSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!result.success) {
    return c.json(
      failure(
        'Invalid Skill publish payload',
        'skill_generation.invalid_publish_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID, userUUID } = await getWebSession(c.req);
    return c.json(
      success(
        await publishGeneratedSkill({
          uuid: c.req.param('uuid') ?? '',
          teamUUID,
          creatorUUID: userUUID,
          ...result.data
        })
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

function handleKnownError(c: Context, error: unknown) {
  if (error instanceof SkillGenerationSessionNotFoundError) {
    return c.json(failure(error.message, 'skill_generation.not_found'), 404);
  }
  if (
    error instanceof SkillGenerationRevisionConflictError ||
    error instanceof SkillGenerationBusyError
  ) {
    return c.json(
      failure(
        error.message,
        error instanceof SkillGenerationBusyError
          ? 'skill_generation.busy'
          : 'skill_generation.revision_conflict'
      ),
      409
    );
  }
  if (
    error instanceof SkillGenerationScriptReviewRequiredError ||
    error instanceof InvalidGeneratedSkillError
  ) {
    return c.json(
      failure(
        error.message,
        error instanceof SkillGenerationScriptReviewRequiredError
          ? 'skill_generation.script_review_required'
          : 'skill_generation.invalid_files'
      ),
      400
    );
  }
  if (error instanceof SkillConflictError) {
    return c.json(failure(error.message, 'skills.conflict'), 409);
  }
  throw error;
}
