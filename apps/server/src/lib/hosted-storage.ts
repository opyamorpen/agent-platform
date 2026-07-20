import { Readable } from 'node:stream';
import * as onesNodeSdk from '@ones-open/node-sdk';
import { getLogger } from './logger.js';

type PrimitiveValue = string | number | boolean;
type HostedEntityQueryResult<T extends object> = {
  data: Array<{ key: string; value: T }>;
  page_info: {
    has_more: boolean;
    end_cursor: string;
  };
};

type HostedEntity<T extends object> = {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: Partial<T>): Promise<void>;
  delete(key: string): Promise<void>;
  query(): {
    limit(value: number): {
      getMany(): Promise<HostedEntityQueryResult<T>>;
      cursor(value: string): {
        getMany(): Promise<HostedEntityQueryResult<T>>;
      };
    };
    index(name: string): {
      where(condition: unknown): {
        limit(value: number): {
          getMany(): Promise<HostedEntityQueryResult<T>>;
          cursor(value: string): {
            getMany(): Promise<HostedEntityQueryResult<T>>;
          };
        };
      };
    };
  };
};

type HostedObjectUploadResult = {
  getFields(): Record<string, string>;
  getUrl(): string;
  getWebUrl?(): string;
};

type HostedObjectDownloadResult = {
  getUrl(): string;
  getWebUrl?(): string;
};

type HostedObjectMetadata = {
  content_type: string;
};

type HostedObjectError = {
  code?: string;
};

type HostedStorageModule = {
  storage: {
    entity: {
      <T extends object>(name: string): HostedEntity<T>;
      WhereConditions: {
        equalTo(value: PrimitiveValue): unknown;
      };
    };
    object: {
      upload(
        key: string
      ): Promise<HostedObjectUploadResult | HostedObjectError>;
      metadata(
        key: string
      ): Promise<HostedObjectMetadata | HostedObjectError>;
      download(
        key: string
      ): Promise<HostedObjectDownloadResult | HostedObjectError>;
      delete(key: string): Promise<unknown>;
      ObjectError: new (...args: unknown[]) => {
        code?: string;
      };
      ObjectErrorCode: {
        ObjectNotFound: string;
      };
    };
  };
};

const storage = (onesNodeSdk as unknown as HostedStorageModule).storage;
const logger = getLogger('hosted-storage');
const preferHostedWebUrl = process.env.NODE_ENV !== 'production';

export class HostedStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostedStorageConfigError';
  }
}

export interface HostedEntityEntry<T extends object> {
  key: string;
  value: T;
}

export interface HostedEntityStore<T extends object> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: Partial<T>): Promise<void>;
  delete(key: string): Promise<void>;
  getMany(): Promise<Array<HostedEntityEntry<T>>>;
  queryByIndexEqualTo<K extends keyof T & string>(
    indexName: string,
    attributeName: K,
    value: T[K] & PrimitiveValue
  ): Promise<Array<HostedEntityEntry<T>>>;
}

const OBJECT_READBACK_RETRY_DELAYS_MS = [50, 100, 200, 400, 800] as const;

function normalizeHostedObjectKeySegment(value: string | number): string {
  const normalized = String(value)
    .trim()
    .replace(/[^0-9a-zA-Z!_.*'()-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || 'x';
}

export function buildHostedObjectKey(...segments: Array<string | number>): string {
  return segments.map((segment) => normalizeHostedObjectKeySegment(segment)).join('_');
}

function resolveHostedObjectKey(key: string): string {
  return buildHostedObjectKey(key);
}

function assertHostedStorageEnabled(): void {
  const hasHostedToken = Boolean(process.env.ONES_HOSTED_TOKEN);
  const hasHostedAppId = Boolean(process.env.ONES_HOSTED_APP_ID);
  const hasHostedManagerBaseUrl = Boolean(process.env.ONES_HOSTED_MANAGER_BASE_URL);

  if (
    hasHostedToken &&
    hasHostedAppId &&
    hasHostedManagerBaseUrl
  ) {
    return;
  }

  logger.error('[hosted-storage] missing hosted storage env', {
    hasHostedToken,
    hasHostedAppId,
    hasHostedManagerBaseUrl
  });

  throw new HostedStorageConfigError(
    'ONES hosted storage is not configured. Set ONES_HOSTED_TOKEN, ONES_HOSTED_APP_ID, and ONES_HOSTED_MANAGER_BASE_URL.'
  );
}

function isHostedObjectError(value: unknown): value is HostedObjectError {
  return (
    value instanceof storage.object.ObjectError ||
    Boolean(
      value &&
        typeof value === 'object' &&
        typeof (value as { code?: unknown }).code === 'string'
    )
  );
}

function isHostedObjectNotFound(value: HostedObjectError): boolean {
  const code = value.code ?? '';
  return (
    code === storage.object.ObjectErrorCode.ObjectNotFound ||
    code === 'ObjectKeyNotfound' ||
    code === 'ObjectKeyNotFound' ||
    code === 'OBJECT_NOT_FOUND'
  );
}

export function createEntityStore<T extends object>(
  entityName: string
): HostedEntityStore<T> {
  const hostedEntity = storage.entity<T>(entityName);

  return {
    async get(key: string): Promise<T | undefined> {
      assertHostedStorageEnabled();
      try {
        return (await hostedEntity.get(key)) as T | undefined;
      } catch (error) {
        logger.error('[hosted-storage] entity get failed', {
          entityName,
          key,
          error
        });
        throw error;
      }
    },
    async set(key: string, value: Partial<T>): Promise<void> {
      assertHostedStorageEnabled();
      try {
        await hostedEntity.set(key, value);
      } catch (error) {
        logger.error('[hosted-storage] entity set failed', {
          entityName,
          key,
          error
        });
        throw error;
      }
    },
    async delete(key: string): Promise<void> {
      assertHostedStorageEnabled();
      try {
        await hostedEntity.delete(key);
      } catch (error) {
        logger.error('[hosted-storage] entity delete failed', {
          entityName,
          key,
          error
        });
        throw error;
      }
    },
    async getMany(): Promise<Array<HostedEntityEntry<T>>> {
      assertHostedStorageEnabled();

      const entries: Array<HostedEntityEntry<T>> = [];
      let cursor: string | undefined;

      while (true) {
        const query = hostedEntity.query().limit(1000);
        const result = cursor
          ? await query.cursor(cursor).getMany()
          : await query.getMany();

        entries.push(
          ...result.data.map((item) => ({
            key: item.key,
            value: item.value as T
          }))
        );

        if (!result.page_info.has_more) {
          break;
        }

        cursor = result.page_info.end_cursor;
      }

      return entries;
    },
    async queryByIndexEqualTo<K extends keyof T & string>(
      indexName: string,
      _attributeName: K,
      value: T[K] & PrimitiveValue
    ): Promise<Array<HostedEntityEntry<T>>> {
      assertHostedStorageEnabled();

      const entries: Array<HostedEntityEntry<T>> = [];
      let cursor: string | undefined;

      while (true) {
        const query = hostedEntity
          .query()
          .index(indexName)
          .where(storage.entity.WhereConditions.equalTo(value))
          .limit(1000);
        const result = cursor
          ? await query.cursor(cursor).getMany()
          : await query.getMany();

        entries.push(
          ...result.data.map((item) => ({
            key: item.key,
            value: item.value as T
          }))
        );

        if (!result.page_info.has_more) {
          break;
        }

        cursor = result.page_info.end_cursor;
      }

      return entries;
    }
  };
}

export async function uploadObjectBuffer(
  key: string,
  content: Buffer,
  contentType = 'application/octet-stream'
): Promise<void> {
  assertHostedStorageEnabled();
  const resolvedKey = resolveHostedObjectKey(key);

  let uploadResult: HostedObjectUploadResult | HostedObjectError;

  try {
    uploadResult = await storage.object.upload(resolvedKey);
  } catch (error) {
    logger.error('[hosted-storage] object upload init failed', {
      key,
      resolvedKey,
      contentType,
      error
    });
    throw error;
  }

  if (isHostedObjectError(uploadResult)) {
    logger.error('[hosted-storage] object upload init returned error', {
      key,
      resolvedKey,
      contentType,
      uploadResult
    });
    throw uploadResult;
  }

  const formData = new FormData();
  const fields = uploadResult.getFields();

  for (const [field, value] of Object.entries(fields)) {
    formData.set(field, value);
  }

  formData.set('file', new Blob([content], { type: contentType }));

  let response: Response;
  const uploadUrl = resolveHostedObjectUploadUrl(uploadResult);

  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
  } catch (error) {
    logger.error('[hosted-storage] object upload request failed', {
      key,
      resolvedKey,
      contentType,
      error
    });
    throw error;
  }

  if (!response.ok) {
    logger.error('[hosted-storage] object upload response failed', {
      key,
      resolvedKey,
      contentType,
      status: response.status,
      statusText: response.statusText
    });
    throw new Error(
      `Hosted object upload failed: ${response.status} ${response.statusText}`
    );
  }
}

function resolveHostedObjectUploadUrl(
  uploadResult: HostedObjectUploadResult
): string {
  if (preferHostedWebUrl && typeof uploadResult.getWebUrl === 'function') {
    const webUrl = uploadResult.getWebUrl().trim();

    if (webUrl) {
      return webUrl;
    }
  }

  return uploadResult.getUrl();
}

function resolveHostedObjectDownloadUrl(
  downloadResult: HostedObjectDownloadResult
): string {
  if (preferHostedWebUrl && typeof downloadResult.getWebUrl === 'function') {
    const webUrl = downloadResult.getWebUrl().trim();

    if (webUrl) {
      return webUrl;
    }
  }

  return downloadResult.getUrl();
}

export async function getObjectDownloadUrl(key: string): Promise<string | null> {
  assertHostedStorageEnabled();
  const resolvedKey = resolveHostedObjectKey(key);
  const downloadResult = await storage.object.download(resolvedKey);

  if (isHostedObjectError(downloadResult)) {
    if (isHostedObjectNotFound(downloadResult)) {
      return null;
    }

    throw downloadResult;
  }

  return resolveHostedObjectDownloadUrl(downloadResult);
}

export async function openObjectStream(key: string): Promise<{
  stream: NodeJS.ReadableStream;
  contentType: string;
} | null> {
  assertHostedStorageEnabled();
  const resolvedKey = resolveHostedObjectKey(key);

  const metadata = await storage.object.metadata(resolvedKey);

  if (isHostedObjectError(metadata)) {
    if (isHostedObjectNotFound(metadata)) {
      return null;
    }

    throw metadata;
  }

  const downloadResult = await storage.object.download(resolvedKey);

  if (isHostedObjectError(downloadResult)) {
    if (isHostedObjectNotFound(downloadResult)) {
      return null;
    }

    throw downloadResult;
  }

  const downloadUrl = resolveHostedObjectDownloadUrl(downloadResult);
  const response = await fetch(downloadUrl);

  if (!response.ok || !response.body) {
    throw new Error(
      `Hosted object download failed: ${response.status} ${response.statusText}`
    );
  }

  return {
    stream: Readable.fromWeb(response.body as ReadableStream),
    contentType: metadata.content_type
  };
}

export async function readObjectText(key: string): Promise<string | null> {
  const result = await openObjectStream(key);

  if (!result) {
    return null;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of result.stream) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

export async function uploadObjectJson(
  key: string,
  value: unknown
): Promise<void> {
  const serializedValue = JSON.stringify(value);

  await uploadObjectBuffer(
    key,
    Buffer.from(serializedValue, 'utf8'),
    'application/json'
  );
  await waitForObjectTextMatch(key, serializedValue);
}

export async function readObjectJson<T>(key: string): Promise<T | null> {
  const content = await readObjectText(key);

  if (!content) {
    return null;
  }

  return JSON.parse(content) as T;
}

export async function deleteObject(key: string): Promise<void> {
  assertHostedStorageEnabled();
  const resolvedKey = resolveHostedObjectKey(key);

  const result = await storage.object.delete(resolvedKey);

  if (result instanceof storage.object.ObjectError) {
    throw result;
  }
}

export async function waitForObjectTextMatch(
  key: string,
  expectedContent: string,
  dependencies: {
    readObjectText?: (key: string) => Promise<string | null>;
    sleep?: (ms: number) => Promise<void>;
    retryDelaysMs?: readonly number[];
  } = {}
): Promise<void> {
  const readObjectTextImpl = dependencies.readObjectText ?? readObjectText;
  const sleepImpl = dependencies.sleep ?? sleep;
  const retryDelaysMs =
    dependencies.retryDelaysMs ?? OBJECT_READBACK_RETRY_DELAYS_MS;
  let lastContent: string | null = null;

  for (let attemptIndex = 0; attemptIndex <= retryDelaysMs.length; attemptIndex += 1) {
    lastContent = await readObjectTextImpl(key);

    if (lastContent === expectedContent) {
      return;
    }

    if (attemptIndex < retryDelaysMs.length) {
      await sleepImpl(retryDelaysMs[attemptIndex] ?? 0);
    }
  }

  logger.error('[hosted-storage] object readback verification failed', {
    key,
    expectedLength: expectedContent.length,
    actualLength: lastContent?.length ?? null
  });

  throw new Error(`Hosted object readback verification failed: ${key}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
