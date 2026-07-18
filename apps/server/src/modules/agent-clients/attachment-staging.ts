import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { resolveWorkspacePath } from '../../lib/runtime-path.js';

const ATTACHMENT_STAGING_ROOT = resolveWorkspacePath(
  '.storage',
  'agent-client-attachments'
);

interface StoredAttachmentMetadata {
  resourceToken: string;
  taskUUID: string;
  clientUUID: string;
  localPath: string;
  originalFileName: string;
  storedFileName: string;
  contentType: string;
  createdAt: string;
}

export interface StagedAttachmentInput {
  localPath: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface StagedAttachment {
  resourceToken: string;
  fileName: string;
  localPath: string;
}

export interface LoadedStagedAttachment {
  resourceToken: string;
  fileName: string;
  localPath: string;
  filePath: string;
  remove(): Promise<void>;
}

export async function stageAgentClientTaskAttachments(input: {
  taskUUID: string;
  clientUUID: string;
  files: StagedAttachmentInput[];
}): Promise<StagedAttachment[]> {
  if (input.files.length === 0) {
    return [];
  }

  const taskDirectory = getTaskDirectory(input.taskUUID);
  await mkdir(taskDirectory, { recursive: true });

  const uploads: StagedAttachment[] = [];

  for (const file of input.files) {
    const resourceToken = randomUUID();
    const safeFileName = sanitizeFileName(file.fileName);
    const storedFileName = `${resourceToken}-${safeFileName}`;
    const filePath = path.join(taskDirectory, storedFileName);
    const metadataPath = getMetadataPath(input.taskUUID, resourceToken);
    const metadata: StoredAttachmentMetadata = {
      resourceToken,
      taskUUID: input.taskUUID,
      clientUUID: input.clientUUID,
      localPath: file.localPath,
      originalFileName: file.fileName,
      storedFileName,
      contentType: file.contentType,
      createdAt: new Date().toISOString()
    };

    await writeFile(filePath, file.bytes);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    uploads.push({
      resourceToken,
      fileName: file.fileName,
      localPath: file.localPath
    });
  }

  return uploads;
}

export async function loadAgentClientTaskAttachment(input: {
  taskUUID: string;
  clientUUID: string;
  resourceToken: string;
}): Promise<LoadedStagedAttachment> {
  const metadata = await readAttachmentMetadata(
    input.taskUUID,
    input.resourceToken
  );

  if (
    metadata.taskUUID !== input.taskUUID ||
    metadata.clientUUID !== input.clientUUID
  ) {
    throw new Error(
      `Attachment token does not belong to task: ${input.resourceToken}`
    );
  }

  const filePath = path.join(
    getTaskDirectory(input.taskUUID),
    metadata.storedFileName
  );

  return {
    resourceToken: metadata.resourceToken,
    fileName: metadata.originalFileName,
    localPath: metadata.localPath,
    filePath,
    remove: async () => {
      await rm(filePath, { force: true }).catch(() => undefined);
      await rm(getMetadataPath(input.taskUUID, input.resourceToken), {
        force: true
      }).catch(() => undefined);
    }
  };
}

export async function removeAgentClientTaskAttachments(
  taskUUID: string
): Promise<void> {
  await rm(getTaskDirectory(taskUUID), { recursive: true, force: true }).catch(
    () => undefined
  );
}

async function readAttachmentMetadata(
  taskUUID: string,
  resourceToken: string
): Promise<StoredAttachmentMetadata> {
  const metadataPath = getMetadataPath(taskUUID, resourceToken);
  const content = await readFile(metadataPath, 'utf8');
  return JSON.parse(content) as StoredAttachmentMetadata;
}

function getTaskDirectory(taskUUID: string): string {
  return path.join(ATTACHMENT_STAGING_ROOT, taskUUID);
}

function getMetadataPath(taskUUID: string, resourceToken: string): string {
  return path.join(getTaskDirectory(taskUUID), `${resourceToken}.json`);
}

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName).trim();
  return baseName || 'attachment';
}
