import { createHash } from 'node:crypto';
import type {
  AgentClientPreviousWorkspacePatch,
  AgentClientWorkspacePatchBundle,
  AgentClientWorkspacePatchUpload
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  getObjectDownloadUrl,
  uploadObjectBuffer
} from '../../lib/hosted-storage.js';
import type { IssueAgentExecutionHistoryRecord } from '../executions/repository.js';
import { findIssueAgentExecutionHistoryByUUID } from '../executions/repository.js';

const MAX_PATCH_BYTES = 20 * 1024 * 1024;

function getWorkspacePatchObjectKey(teamUUID: string, taskUUID: string): string {
  return buildHostedObjectKey(
    'issue-agent-execution',
    teamUUID,
    taskUUID,
    'workspace-patch.json'
  );
}

export class AgentClientWorkspacePatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentClientWorkspacePatchError';
  }
}

function parsePatchBundle(bytes: Uint8Array): AgentClientWorkspacePatchBundle {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PATCH_BYTES) {
    throw new AgentClientWorkspacePatchError(
      `Workspace patch size must be between 1 and ${MAX_PATCH_BYTES} bytes`
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new AgentClientWorkspacePatchError('Workspace patch must be valid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentClientWorkspacePatchError('Workspace patch bundle is invalid');
  }
  const bundle = value as Partial<AgentClientWorkspacePatchBundle>;
  if (
    bundle.version !== 1 ||
    typeof bundle.sourceTaskUUID !== 'string' ||
    !Array.isArray(bundle.repositories)
  ) {
    throw new AgentClientWorkspacePatchError('Workspace patch bundle is invalid');
  }
  if (bundle.repositories.length > 20) {
    throw new AgentClientWorkspacePatchError('Workspace patch has too many repositories');
  }
  for (const repository of bundle.repositories) {
    if (
      !repository ||
      typeof repository.repositoryUUID !== 'string' ||
      typeof repository.repositoryName !== 'string' ||
      typeof repository.patch !== 'string' ||
      !Number.isInteger(repository.changedFiles) ||
      !Number.isInteger(repository.additions) ||
      !Number.isInteger(repository.deletions)
    ) {
      throw new AgentClientWorkspacePatchError('Workspace patch repository is invalid');
    }
  }
  return bundle as AgentClientWorkspacePatchBundle;
}

export async function uploadAgentClientWorkspacePatch(input: {
  teamUUID: string;
  taskUUID: string;
  bytes: Uint8Array;
}): Promise<AgentClientWorkspacePatchUpload> {
  const bundle = parsePatchBundle(input.bytes);
  if (bundle.sourceTaskUUID !== input.taskUUID) {
    throw new AgentClientWorkspacePatchError(
      'Workspace patch source task does not match upload task'
    );
  }
  const buffer = Buffer.from(input.bytes);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  await uploadObjectBuffer(
    getWorkspacePatchObjectKey(input.teamUUID, input.taskUUID),
    buffer,
    'application/json; charset=utf-8'
  );
  return {
    sourceTaskUUID: input.taskUUID,
    sha256,
    byteSize: buffer.byteLength,
    repositoryCount: bundle.repositories.length,
    changedFiles: bundle.repositories.reduce(
      (total, repository) => total + repository.changedFiles,
      0
    ),
    additions: bundle.repositories.reduce(
      (total, repository) => total + repository.additions,
      0
    ),
    deletions: bundle.repositories.reduce(
      (total, repository) => total + repository.deletions,
      0
    )
  };
}

function getPreviousAttemptUUID(task: IssueAgentExecutionHistoryRecord): string | null {
  if (!task.executeOption || typeof task.executeOption !== 'object' || Array.isArray(task.executeOption)) {
    return null;
  }
  const loopContext = (task.executeOption as { loopContext?: unknown }).loopContext;
  if (!loopContext || typeof loopContext !== 'object' || Array.isArray(loopContext)) {
    return null;
  }
  const previousAttemptUUID = (loopContext as { previousAttemptUUID?: unknown }).previousAttemptUUID;
  return typeof previousAttemptUUID === 'string' && previousAttemptUUID.trim()
    ? previousAttemptUUID.trim()
    : null;
}

function getPatchUpload(value: unknown): AgentClientWorkspacePatchUpload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const patch = (value as { workspacePatch?: unknown }).workspacePatch;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return null;
  }
  const candidate = patch as Partial<AgentClientWorkspacePatchUpload>;
  return typeof candidate.sourceTaskUUID === 'string' &&
    typeof candidate.sha256 === 'string' &&
    typeof candidate.byteSize === 'number'
    ? (candidate as AgentClientWorkspacePatchUpload)
    : null;
}

export async function getPreviousWorkspacePatchDescriptor(
  task: IssueAgentExecutionHistoryRecord,
  teamUUID: string
): Promise<AgentClientPreviousWorkspacePatch | null> {
  const sourceTaskUUID = getPreviousAttemptUUID(task);
  if (!sourceTaskUUID) {
    return null;
  }
  const previousTask = await findIssueAgentExecutionHistoryByUUID(
    sourceTaskUUID,
    teamUUID
  );
  const upload = getPatchUpload(previousTask?.executeResult);
  if (!previousTask || !upload || upload.sourceTaskUUID !== sourceTaskUUID) {
    return null;
  }
  return {
    sourceTaskUUID,
    sha256: upload.sha256,
    downloadPath: `/api/agent-clients/tasks/${task.uuid}/previous-patch`
  };
}

export async function openPreviousWorkspacePatch(input: {
  task: IssueAgentExecutionHistoryRecord;
  teamUUID: string;
}) {
  const descriptor = await getPreviousWorkspacePatchDescriptor(
    input.task,
    input.teamUUID
  );
  if (!descriptor) {
    return null;
  }
  return {
    descriptor,
    downloadUrl: await getObjectDownloadUrl(
      getWorkspacePatchObjectKey(input.teamUUID, descriptor.sourceTaskUUID)
    )
  };
}

export async function openExecutionWorkspacePatch(
  taskUUID: string,
  teamUUID: string
) {
  const task = await findIssueAgentExecutionHistoryByUUID(taskUUID, teamUUID);
  const upload = getPatchUpload(task?.executeResult);
  if (!task || !upload) {
    return null;
  }
  return {
    upload,
    downloadUrl: await getObjectDownloadUrl(
      getWorkspacePatchObjectKey(teamUUID, taskUUID)
    )
  };
}
