import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import {
  createAgentWorkspaceSchema,
  createWorkspaceCredentialSchema,
  createRepositorySchema,
  updateAgentWorkspaceSchema,
  updateRepositorySchema,
  updateWorkspaceAuthSchema
} from './dto.js';
import {
  AgentWorkspaceAuthError,
  AgentWorkspaceInUseError,
  AgentWorkspaceNotFoundError,
  createAgentWorkspaceRecord,
  createRepositoryRecord,
  getAgentWorkspaces,
  getAgentWorkspaceCredentials,
  regenerateAgentWorkspaceKeyRecord,
  removeAgentWorkspaceCredentialRecord,
  removeAgentWorkspaceRecord,
  removeRepositoryRecord,
  RepositoryNotFoundError,
  updateAgentWorkspaceRecord,
  updateAgentWorkspaceAuthRecord,
  updateRepositoryRecord,
  upsertAgentWorkspaceCredentialRecord,
  WorkspaceCredentialNotFoundError
} from './service.js';

export async function listAgentWorkspacesHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getAgentWorkspaces(teamUUID)));
}

export async function createAgentWorkspaceHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = createAgentWorkspaceSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent workspace payload',
        'agent_workspaces.invalid_payload'
      ),
      400
    );
  }

  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await createAgentWorkspaceRecord(result.data, teamUUID)), 201);
}

export async function updateAgentWorkspaceHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = updateAgentWorkspaceSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent workspace payload',
        'agent_workspaces.invalid_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await updateAgentWorkspaceRecord(uuid, result.data, teamUUID))
    );
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    if (error instanceof AgentWorkspaceInUseError) {
      return c.json(
        failure(error.message, 'agent_workspaces.in_use'),
        409
      );
    }

    throw error;
  }
}

export async function deleteAgentWorkspaceHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeAgentWorkspaceRecord(uuid, teamUUID);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    if (error instanceof AgentWorkspaceAuthError) {
      return c.json(
        failure(error.message, 'agent_workspaces.auth_conflict'),
        409
      );
    }

    throw error;
  }
}

export async function regenerateAgentWorkspaceKeyHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await regenerateAgentWorkspaceKeyRecord(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    throw error;
  }
}

export async function updateAgentWorkspaceAuthHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = updateWorkspaceAuthSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid workspace auth payload',
        'agent_workspaces.invalid_auth_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await updateAgentWorkspaceAuthRecord(uuid, result.data, teamUUID))
    );
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    if (error instanceof AgentWorkspaceAuthError) {
      return c.json(
        failure(error.message, 'agent_workspaces.auth_conflict'),
        409
      );
    }

    throw error;
  }
}

export async function createRepositoryHandler(c: Context) {
  const agentWorkspaceUUID = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = createRepositorySchema.safeParse(body);

  if (!agentWorkspaceUUID) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid repository payload',
        'agent_workspaces.invalid_repository_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await createRepositoryRecord(agentWorkspaceUUID, result.data, teamUUID)),
      201
    );
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    if (error instanceof AgentWorkspaceAuthError) {
      return c.json(
        failure(error.message, 'agent_workspaces.auth_conflict'),
        409
      );
    }

    throw error;
  }
}

export async function updateRepositoryHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = updateRepositorySchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure(
        'Repository uuid is required',
        'agent_workspaces.repository_uuid_required'
      ),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid repository payload',
        'agent_workspaces.invalid_repository_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await updateRepositoryRecord(uuid, result.data, teamUUID)));
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.repository_not_found'),
        404
      );
    }

    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    if (error instanceof AgentWorkspaceAuthError) {
      return c.json(
        failure(error.message, 'agent_workspaces.auth_conflict'),
        409
      );
    }

    throw error;
  }
}

export async function deleteRepositoryHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Repository uuid is required',
        'agent_workspaces.repository_uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await removeRepositoryRecord(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.repository_not_found'),
        404
      );
    }

    throw error;
  }
}

export async function listWorkspaceCredentialsHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getAgentWorkspaceCredentials(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    throw error;
  }
}

export async function createWorkspaceCredentialHandler(c: Context) {
  const agentWorkspaceUUID = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = createWorkspaceCredentialSchema.safeParse(body);

  if (!agentWorkspaceUUID) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure(
        'Invalid workspace credential payload',
        'agent_workspaces.invalid_credential_payload'
      ),
      400
    );
  }

  try {
    const { teamUUID, userUUID } = await getWebSession(c.req);
    return c.json(
      success(
        await upsertAgentWorkspaceCredentialRecord(
          agentWorkspaceUUID,
          result.data,
          userUUID,
          teamUUID
        )
      ),
      201
    );
  } catch (error) {
    if (error instanceof AgentWorkspaceNotFoundError) {
      return c.json(
        failure(error.message, 'agent_workspaces.not_found'),
        404
      );
    }

    throw error;
  }
}

export async function deleteWorkspaceCredentialHandler(c: Context) {
  const agentWorkspaceUUID = c.req.param('uuid');
  const envName = c.req.param('envName')?.trim();

  if (!agentWorkspaceUUID) {
    return c.json(
      failure(
        'Agent workspace uuid is required',
        'agent_workspaces.uuid_required'
      ),
      400
    );
  }

  if (!envName) {
    return c.json(
      failure(
        'Credential env name is required',
        'agent_workspaces.credential_env_name_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeAgentWorkspaceCredentialRecord(
      agentWorkspaceUUID,
      envName,
      teamUUID
    );
    return c.body(null, 204);
  } catch (error) {
    if (
      error instanceof AgentWorkspaceNotFoundError ||
      error instanceof WorkspaceCredentialNotFoundError
    ) {
      return c.json(
        failure(error.message, 'agent_workspaces.credential_not_found'),
        404
      );
    }

    throw error;
  }
}
