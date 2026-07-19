import type {
  AgentClientConnectPollRequest,
  AgentClientConnectPollResponse,
  AgentClientConnectRequest,
  AgentClientConnectResponse,
  AgentClientTask,
  AgentClientTaskRuntimeEnvResponse,
  AgentClientTaskAttachmentUploadResponse,
  AgentClientTaskReport,
  ApiError,
  ApiSuccess,
  SkillManifest
} from '@ones-ai-workflow/shared';
import { logger } from './logger.js';

type AgentClientTaskReportRequest = {
  reports: AgentClientTaskReport[];
};

type AgentClientTaskReportResponse = {
  accepted: true;
};

type AgentClientTaskClaimRequest = {
  availableSlots: number;
};

type AgentClientTaskClaimResponse = {
  tasks: AgentClientTask[];
};

export class AgentClientApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly method: string,
    public readonly url: string,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'AgentClientApiError';
  }
}

export async function connectToServer(
  serverBaseUrl: string,
  request: AgentClientConnectRequest
): Promise<AgentClientConnectResponse> {
  return requestJson<AgentClientConnectResponse>(
    `${serverBaseUrl}/api/agent-clients/connect`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(request)
    },
    'Agent client connect failed'
  );
}

export async function pollServerConnection(
  serverBaseUrl: string,
  request: AgentClientConnectPollRequest
): Promise<AgentClientConnectPollResponse> {
  return requestJson<AgentClientConnectPollResponse>(
    `${serverBaseUrl}/api/agent-clients/connect/poll`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(request)
    },
    'Agent client connection poll failed'
  );
}

export async function reportTaskStatusToServer(
  serverBaseUrl: string,
  accessToken: string,
  request: AgentClientTaskReportRequest
): Promise<AgentClientTaskReportResponse> {
  return requestJson<AgentClientTaskReportResponse>(
    `${serverBaseUrl}/api/agent-clients/tasks/report`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(request)
    },
    'Agent client task report failed'
  );
}

export async function claimTasksFromServer(
  serverBaseUrl: string,
  accessToken: string,
  request: AgentClientTaskClaimRequest
): Promise<AgentClientTaskClaimResponse> {
  return requestJson<AgentClientTaskClaimResponse>(
    `${serverBaseUrl}/api/agent-clients/tasks/claim`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(request)
    },
    'Agent client task claim failed'
  );
}

export async function uploadTaskAttachmentsToServer(
  serverBaseUrl: string,
  accessToken: string,
  taskUUID: string,
  files: Array<{
    localPath: string;
    fileName: string;
    bytes: Uint8Array;
    contentType?: string;
  }>
): Promise<AgentClientTaskAttachmentUploadResponse> {
  const formData = new FormData();

  for (const file of files) {
    formData.append('localPaths', file.localPath);
    formData.append(
      'files',
      new File([file.bytes], file.fileName, {
        type: file.contentType ?? 'application/octet-stream'
      })
    );
  }

  return requestJson<AgentClientTaskAttachmentUploadResponse>(
    `${serverBaseUrl}/api/agent-clients/tasks/${taskUUID}/attachments`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      body: formData
    },
    'Agent client attachment upload failed'
  );
}

export async function fetchTaskRuntimeEnvFromServer(
  serverBaseUrl: string,
  accessToken: string,
  taskUUID: string
): Promise<AgentClientTaskRuntimeEnvResponse> {
  return requestJson<AgentClientTaskRuntimeEnvResponse>(
    `${serverBaseUrl}/api/agent-clients/tasks/${taskUUID}/runtime-env`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    },
    'Agent client task runtime env fetch failed'
  );
}

export async function fetchSkillsManifest(
  serverBaseUrl: string,
  accessToken: string
): Promise<SkillManifest> {
  return requestJson<SkillManifest>(
    `${serverBaseUrl}/api/agent-clients/skills/manifest`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    },
    'Fetch skills manifest failed'
  );
}

export async function downloadFileFromServer(
  serverBaseUrl: string,
  accessToken: string,
  downloadPath: string
): Promise<Response> {
  const url = new URL(downloadPath, `${serverBaseUrl}/`).toString();
  const method = 'GET';
  const startedAt = Date.now();

  logger.debug(`<-- ${method}`, {
    url
  });

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  logger.debug(`--> ${method}`, {
    url,
    status: response.status,
    durationMs: Date.now() - startedAt
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const payload = safeParseText<ApiError>(responseBody);

    throw new AgentClientApiError(
      payload?.success === false ? payload.message : 'Download file failed',
      response.status,
      method,
      url,
      responseBody
    );
  }

  return response;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const startedAt = Date.now();

  logger.debug(`<-- ${method}`, {
    url
  });

  const response = await fetch(url, init);
  const responseBody = await response.text().catch(() => '');

  logger.debug(`--> ${method}`, {
    url,
    status: response.status,
    durationMs: Date.now() - startedAt
  });

  const payload = safeParseText<ApiSuccess<T> | ApiError>(responseBody);

  if (!response.ok || !payload?.success) {
    throw new AgentClientApiError(
      payload && !payload.success ? payload.message : fallbackMessage,
      response.status,
      method,
      url,
      responseBody
    );
  }

  return payload.data;
}

function safeParseText<T>(value: string): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
