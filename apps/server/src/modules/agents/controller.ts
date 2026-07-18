import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import {
  agentPromptPreviewSchema,
  agentPromptRecommendationSchema,
  createAgentSchema,
  duplicateAgentSchema,
  publishAgentSchema,
  saveAgentDraftSchema,
  updateAgentSchema
} from './dto.js';
import {
  AgentConflictError,
  AgentDraftNotFoundError,
  AgentExecutionTargetBindingError,
  AgentInUseError,
  AgentKnowledgeBindingNotFoundError,
  AgentWikiWriteTargetRequiredError,
  AgentNotFoundError,
  AgentSkillBindingNotFoundError,
  AgentWorkspaceBindingNotFoundError,
  AgentVerificationProfileBindingError,
  createAgentRecord,
  duplicateAgentRecord,
  getAgentDraft,
  getAgentSummaries,
  previewAgentPrompt,
  publishAgentDraft,
  removeAgent,
  saveAgentDraft,
  updateAgentRecord
} from './service.js';
import { randomUUID } from 'node:crypto';
import { streamAIEvents } from '../../lib/sse.js';
import { streamPromptRecommendation } from './prompt-recommendation.js';

export async function listAgentsHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getAgentSummaries(teamUUID)));
}

export async function previewAgentPromptHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = agentPromptPreviewSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent prompt preview payload',
        'agents.invalid_prompt_preview_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await previewAgentPrompt(result.data, teamUUID)));
  } catch (error) {
    if (error instanceof AgentWorkspaceBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.workspace_binding_not_found'),
        404
      );
    }

    throw error;
  }
}

export async function recommendAgentPromptHandler(c: Context) {
  const result = agentPromptRecommendationSchema.safeParse(
    await c.req.json().catch(() => null)
  );

  if (!result.success) {
    return c.json(
      failure(
        'Invalid prompt recommendation payload',
        'agents.invalid_prompt_recommendation_payload'
      ),
      400
    );
  }

  const { teamUUID } = await getWebSession(c.req);
  const requestUUID = randomUUID();

  return streamAIEvents(c, async ({ signal, send }) => {
    await send('meta', { requestUUID });
    await send('stage', { stage: 'generating' });
    const recommendation = await streamPromptRecommendation({
      payload: result.data,
      teamUUID,
      signal,
      onDelta: (delta) => send('text_delta', { delta })
    });
    await send('done', recommendation);
  });
}

export async function createAgentHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = createAgentSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure('Invalid agent payload', 'agents.invalid_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await createAgentRecord(result.data, teamUUID)), 201);
  } catch (error) {
    if (error instanceof AgentWorkspaceBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.workspace_binding_not_found'),
        404
      );
    }

    if (error instanceof AgentSkillBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.skill_binding_not_found'),
        404
      );
    }

    if (error instanceof AgentConflictError) {
      return c.json(failure(error.message, 'agents.conflict'), 409);
    }

    throw error;
  }
}

export async function duplicateAgentHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => ({}));
  const result = duplicateAgentSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure('Agent uuid is required', 'agents.uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent duplicate payload',
        'agents.invalid_duplicate_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await duplicateAgentRecord(uuid, result.data, teamUUID)),
      201
    );
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    throw error;
  }
}

export async function updateAgentHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = updateAgentSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure('Agent uuid is required', 'agents.uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure('Invalid agent payload', 'agents.invalid_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await updateAgentRecord(uuid, result.data, teamUUID))
    );
  } catch (error) {
    if (error instanceof AgentWorkspaceBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.workspace_binding_not_found'),
        404
      );
    }

    if (error instanceof AgentSkillBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.skill_binding_not_found'),
        404
      );
    }

    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    throw error;
  }
}

export async function getAgentDraftHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Agent uuid is required', 'agents.uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getAgentDraft(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    throw error;
  }
}

export async function saveAgentDraftHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = saveAgentDraftSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure('Agent uuid is required', 'agents.uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure('Invalid agent draft payload', 'agents.invalid_draft_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await saveAgentDraft(uuid, result.data, teamUUID)));
  } catch (error) {
    if (error instanceof AgentKnowledgeBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.knowledge_binding_not_found'),
        404
      );
    }

    if (error instanceof AgentVerificationProfileBindingError) {
      return c.json(
        failure(error.message, 'agents.verification_profile_binding_invalid'),
        400
      );
    }

    if (error instanceof AgentExecutionTargetBindingError) {
      return c.json(
        failure(error.message, 'agents.execution_target_invalid'),
        400
      );
    }

    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    throw error;
  }
}

export async function publishAgentDraftHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => ({}));
  const result = publishAgentSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure('Agent uuid is required', 'agents.uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent publish payload',
        'agents.invalid_publish_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await publishAgentDraft(uuid, result.data, teamUUID))
    );
  } catch (error) {
    if (error instanceof AgentKnowledgeBindingNotFoundError) {
      return c.json(
        failure(error.message, 'agents.knowledge_binding_not_found'),
        404
      );
    }

    if (error instanceof AgentVerificationProfileBindingError) {
      return c.json(
        failure(error.message, 'agents.verification_profile_binding_invalid'),
        400
      );
    }

    if (error instanceof AgentExecutionTargetBindingError) {
      return c.json(
        failure(error.message, 'agents.execution_target_invalid'),
        400
      );
    }

    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    if (error instanceof AgentDraftNotFoundError) {
      return c.json(failure(error.message, 'agents.draft_not_found'), 400);
    }

    if (error instanceof AgentWikiWriteTargetRequiredError) {
      return c.json(
        failure(error.message, 'agents.wiki_write_target_required'),
        400
      );
    }

    throw error;
  }
}

export async function deleteAgentHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Agent uuid is required', 'agents.uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeAgent(uuid, teamUUID);
    return c.json(success(true));
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    if (error instanceof AgentInUseError) {
      return c.json(failure(error.message, 'agents.in_use'), 409);
    }

    throw error;
  }
}
