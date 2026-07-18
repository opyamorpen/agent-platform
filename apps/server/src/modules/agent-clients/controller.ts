import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import {
  authenticateAgentClientRequest,
  AgentClientAuthError
} from '../../lib/agent-client-auth.js';
import { getLogger } from '../../lib/logger.js';
import { requireAdmin } from '../../lib/web-access.js';
import { getWebSession } from '../../lib/web-session.js';
import {
  createSkillDownloadUrlPackage,
  getSkillManifest,
  SkillNotFoundError
} from '../skills/service.js';
import {
  agentClientConnectPollSchema,
  agentClientConnectSchema,
  agentClientTaskClaimSchema,
  agentClientTaskReportSchema
} from './dto.js';
import { findAgentClientByUUID } from './repository.js';
import {
  AgentClientInvalidAttachmentUploadError,
  AgentClientInvalidWorkspacePatchError,
  AgentClientNotFoundError,
  approveAgentClientConnection,
  claimAgentClientTasks,
  createAgentClientConnection,
  getAgentClientTaskRuntimeEnv,
  getAgentClientPreviousWorkspacePatchDownload,
  getAgentClients,
  getSelectableAgentClients,
  InvalidAgentClientConnectionRequestError,
  InvalidAgentClientTaskReportError,
  pollAgentClientConnection,
  reportAgentClientTasks,
  stageAgentClientTaskAttachments,
  uploadAgentClientTaskWorkspacePatch,
  revokeAgentClientConnection
} from './service.js';

const logger = getLogger('agent-clients-controller');

type UploadedAgentClientAttachment = {
  localPath: string;
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type AttachmentFormDataValue =
  | string
  | {
      name: string;
      type: string;
      arrayBuffer(): Promise<ArrayBuffer>;
    };

export async function listAgentClientsHandler(c: Context) {
  await requireAdmin(c.req);
  return c.json(success(await getAgentClients()));
}

export async function listSelectableAgentClientsHandler(c: Context) {
  await getWebSession(c.req);
  return c.json(success(await getSelectableAgentClients()));
}

export async function connectAgentClientHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = agentClientConnectSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent client connect payload',
        'agent_clients.invalid_connect_payload'
      ),
      400
    );
  }

  return c.json(success(await createAgentClientConnection(result.data)));
}

export async function pollAgentClientConnectionHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = agentClientConnectPollSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure(
        'Invalid agent client connect poll payload',
        'agent_clients.invalid_connect_poll_payload'
      ),
      400
    );
  }

  try {
    return c.json(success(await pollAgentClientConnection(result.data)));
  } catch (error) {
    if (error instanceof AgentClientNotFoundError) {
      return c.json(failure(error.message, 'agent_clients.not_found'), 404);
    }

    if (error instanceof InvalidAgentClientConnectionRequestError) {
      return c.json(
        failure(error.message, 'agent_clients.invalid_connection_request'),
        401
      );
    }

    throw error;
  }
}

export async function approveAgentClientHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Agent client uuid is required', 'agent_clients.uuid_required'),
      400
    );
  }

  try {
    await requireAdmin(c.req);
    return c.json(success(await approveAgentClientConnection(uuid)));
  } catch (error) {
    if (error instanceof AgentClientNotFoundError) {
      return c.json(failure(error.message, 'agent_clients.not_found'), 404);
    }

    throw error;
  }
}

export async function revokeAgentClientHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Agent client uuid is required', 'agent_clients.uuid_required'),
      400
    );
  }

  try {
    await requireAdmin(c.req);
    return c.json(success(await revokeAgentClientConnection(uuid)));
  } catch (error) {
    if (error instanceof AgentClientNotFoundError) {
      return c.json(failure(error.message, 'agent_clients.not_found'), 404);
    }

    throw error;
  }
}

async function loadAuthenticatedAgentClient(c: Context) {
  const authenticatedClient = await authenticateAgentClientRequest(c);
  const clientRecord = await findAgentClientByUUID(authenticatedClient.uuid);

  if (!clientRecord) {
    return null;
  }

  return {
    uuid: authenticatedClient.uuid,
    name: authenticatedClient.name,
    hostname: clientRecord.hostname,
    version: clientRecord.version
  };
}

export async function reportAgentClientTasksHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = agentClientTaskReportSchema.safeParse(body);

  if (!result.success) {
    return c.json(failure('Invalid agent client task report payload'), 400);
  }

  let client:
    | {
        uuid: string;
        name: string;
        hostname: string;
        version: string;
      }
    | null = null;

  try {
    client = await loadAuthenticatedAgentClient(c);

    if (!client) {
      return c.json(failure('Agent client not found'), 404);
    }

    return c.json(
      success(
        await reportAgentClientTasks(client, {
          reports: result.data.reports.map((report) => ({
            ...report,
            usage: report.usage ?? null
          }))
        })
      )
    );
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }

    if (error instanceof InvalidAgentClientTaskReportError) {
      logger.warn('[agent-clients] invalid task report rejected', {
        path: c.req.path,
        clientUUID: client?.uuid ?? null,
        clientName: client?.name ?? null,
        taskUUIDs: result.data.reports.map((report) => report.taskUUID),
        error: error.message
      });
      return c.json(failure(error.message), 400);
    }

    throw error;
  }
}

export async function claimAgentClientTasksHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = agentClientTaskClaimSchema.safeParse(body);

  if (!result.success) {
    return c.json(failure('Invalid agent client task claim payload'), 400);
  }

  try {
    const client = await loadAuthenticatedAgentClient(c);

    if (!client) {
      return c.json(failure('Agent client not found'), 404);
    }

    return c.json(success(await claimAgentClientTasks(client, result.data)));
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }

    throw error;
  }
}

export async function uploadAgentClientTaskAttachmentsHandler(c: Context) {
  const taskUUID = c.req.param('taskUUID');

  if (!taskUUID) {
    return c.json(failure('Task uuid is required'), 400);
  }

  try {
    const client = await loadAuthenticatedAgentClient(c);

    if (!client) {
      return c.json(failure('Agent client not found'), 404);
    }

    const formData = await c.req.formData();

    return c.json(
      success(
        await stageAgentClientTaskAttachments(
          client,
          taskUUID,
          extractAgentClientTaskAttachments(formData)
        )
      )
    );
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }

    if (error instanceof AgentClientInvalidAttachmentUploadError) {
      return c.json(failure(error.message), 400);
    }

    throw error;
  }
}

function isUploadedAttachmentFile(
  value: AttachmentFormDataValue
): value is Exclude<AttachmentFormDataValue, string> {
  return (
    typeof value !== 'string' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.arrayBuffer === 'function'
  );
}

export function extractAgentClientTaskAttachments(
  formData: FormData
): UploadedAgentClientAttachment[] {
  const files = formData.getAll('files');
  const localPaths = formData
    .getAll('localPaths')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim());

  if (localPaths.length !== files.length || localPaths.some((value) => !value)) {
    throw new AgentClientInvalidAttachmentUploadError(
      'Attachment localPaths must align with files'
    );
  }

  return files.map((fileValue, index) => {
    if (!isUploadedAttachmentFile(fileValue)) {
      throw new AgentClientInvalidAttachmentUploadError('Invalid attachment file');
    }

    return {
      localPath: localPaths[index] ?? '',
      name: fileValue.name,
      type: fileValue.type,
      arrayBuffer: () => fileValue.arrayBuffer()
    };
  });
}

export async function getAgentClientTaskRuntimeEnvHandler(c: Context) {
  const taskUUID = c.req.param('taskUUID');

  if (!taskUUID) {
    return c.json(failure('Task uuid is required'), 400);
  }

  try {
    const client = await loadAuthenticatedAgentClient(c);

    if (!client) {
      return c.json(failure('Agent client not found'), 404);
    }

    return c.json(success(await getAgentClientTaskRuntimeEnv(client, taskUUID)));
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }

    if (error instanceof AgentClientInvalidAttachmentUploadError) {
      return c.json(failure(error.message), 400);
    }

    throw error;
  }
}

export async function uploadAgentClientTaskWorkspacePatchHandler(c: Context) {
  const taskUUID = c.req.param('taskUUID');
  if (!taskUUID) {
    return c.json(failure('Task uuid is required'), 400);
  }
  try {
    const client = await loadAuthenticatedAgentClient(c);
    if (!client) {
      return c.json(failure('Agent client not found'), 404);
    }
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return c.json(failure('Workspace patch file is required'), 400);
    }
    return c.json(
      success(
        await uploadAgentClientTaskWorkspacePatch(
          client,
          taskUUID,
          new Uint8Array(await file.arrayBuffer())
        )
      )
    );
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }
    if (error instanceof AgentClientInvalidWorkspacePatchError) {
      return c.json(failure(error.message), 400);
    }
    throw error;
  }
}

export async function downloadAgentClientPreviousWorkspacePatchHandler(c: Context) {
  const taskUUID = c.req.param('taskUUID');
  if (!taskUUID) {
    return c.json(failure('Task uuid is required'), 400);
  }
  try {
    const client = await loadAuthenticatedAgentClient(c);
    if (!client) {
      return c.json(failure('Agent client not found'), 404);
    }
    const download = await getAgentClientPreviousWorkspacePatchDownload(
      client,
      taskUUID
    );
    return c.redirect(download.downloadUrl, 302);
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }
    if (error instanceof AgentClientInvalidWorkspacePatchError) {
      return c.json(failure(error.message), 404);
    }
    throw error;
  }
}

export async function getAgentClientSkillsManifestHandler(c: Context) {
  try {
    await authenticateAgentClientRequest(c);
    return c.json(success(await getSkillManifest()));
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }

    throw error;
  }
}

export async function downloadAgentClientSkillVersionHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const versionValue = c.req.param('version');
  const version = Number(versionValue);

  if (!uuid) {
    return c.json(failure('Skill uuid is required'), 400);
  }

  if (!Number.isInteger(version) || version <= 0) {
    return c.json(failure('Skill version must be a positive integer'), 400);
  }

  try {
    await authenticateAgentClientRequest(c);
    const downloadPackage = await createSkillDownloadUrlPackage(uuid, version);

    return c.redirect(downloadPackage.downloadUrl, 302);
  } catch (error) {
    if (error instanceof AgentClientAuthError) {
      return c.json(failure(error.message), 401);
    }

    if (error instanceof SkillNotFoundError) {
      return c.json(failure(error.message), 404);
    }

    throw error;
  }
}
