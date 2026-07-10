import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import {
  agentPromptPreviewSchema,
  createAgentSchema,
  duplicateAgentSchema,
  publishAgentSchema,
  saveAgentDraftSchema,
  updateAgentSchema
} from './dto.js';
import {
  AgentConflictError,
  AgentDraftNotFoundError,
  AgentInUseError,
  AgentNotFoundError,
  AgentSkillBindingNotFoundError,
  AgentWorkspaceBindingNotFoundError,
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
    return c.json(failure('Agent uuid is required', 'agents.uuid_required'), 400);
  }

  if (!result.success) {
    return c.json(
      failure('Invalid agent duplicate payload', 'agents.invalid_duplicate_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await duplicateAgentRecord(uuid, result.data, teamUUID)), 201);
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
    return c.json(failure('Agent uuid is required', 'agents.uuid_required'), 400);
  }

  if (!result.success) {
    return c.json(
      failure('Invalid agent payload', 'agents.invalid_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await updateAgentRecord(uuid, result.data, teamUUID)));
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
    return c.json(failure('Agent uuid is required', 'agents.uuid_required'), 400);
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
    return c.json(failure('Agent uuid is required', 'agents.uuid_required'), 400);
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
    return c.json(failure('Agent uuid is required', 'agents.uuid_required'), 400);
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
    return c.json(success(await publishAgentDraft(uuid, result.data, teamUUID)));
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      return c.json(failure(error.message, 'agents.not_found'), 404);
    }

    if (error instanceof AgentDraftNotFoundError) {
      return c.json(failure(error.message, 'agents.draft_not_found'), 400);
    }

    throw error;
  }
}

export async function deleteAgentHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(failure('Agent uuid is required', 'agents.uuid_required'), 400);
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
