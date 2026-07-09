import { createOnesInternalApiClient } from './index.js';
import type { OnesWebContext } from './context.js';
import type { OnesField } from './types.js';
import {
  ISSUE_ATTACHMENT_FIELD_UUID,
  ISSUE_COMMENT_FIELD_REFERENCE_OBJECT_TYPE,
  ISSUE_COMMENT_FIELD_UUID,
  ISSUE_COMMENT_FIELD_VALUE_TYPE
} from './issue.js';

const FIELDS_CACHE_TTL_MS = 60 * 1000;

const fieldsCache = new Map<
  string,
  {
    expiresAt: number;
    value: OnesField[];
  }
>();
const fieldsRequestPromises = new Map<string, Promise<OnesField[]>>();

function getFieldsCacheKey(context: OnesWebContext): string {
  return `${context.teamUUID}:${context.userUUID}`;
}

async function fetchFields(context: OnesWebContext): Promise<OnesField[]> {
  const client = await createOnesInternalApiClient(context);
  const fields = (await client.listFields()).map((field): OnesField => ({
    uuid: field.uuid,
    name: field.name,
    fieldType: field.type?.name ?? field.type?.uuid ?? 'unknown',
    valueType:
      field.uuid === ISSUE_COMMENT_FIELD_UUID
        ? ISSUE_COMMENT_FIELD_VALUE_TYPE
        : field.type?.valueType ?? 'unknown',
    referenceObjectType:
      field.uuid === ISSUE_COMMENT_FIELD_UUID
        ? ISSUE_COMMENT_FIELD_REFERENCE_OBJECT_TYPE
        : field.uuid === ISSUE_ATTACHMENT_FIELD_UUID
          ? 'attachment'
          : field.type?.referenceObjectType ?? null,
    readonly: Boolean(field.type?.readonly || field.type?.noVersion)
  }));

  const deduplicatedFields = new Map<string, OnesField>();

  for (const field of fields) {
    deduplicatedFields.set(field.uuid, field);
  }

  return Array.from(deduplicatedFields.values());
}

export async function listFields(context: OnesWebContext): Promise<OnesField[]> {
  const cacheKey = getFieldsCacheKey(context);
  const cached = fieldsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const currentPromise = fieldsRequestPromises.get(cacheKey);

  if (currentPromise) {
    return currentPromise;
  }

  const requestPromise = fetchFields(context)
    .then((fields) => {
      fieldsCache.set(cacheKey, {
        value: fields,
        expiresAt: Date.now() + FIELDS_CACHE_TTL_MS
      });

      return fields;
    })
    .finally(() => {
      fieldsRequestPromises.delete(cacheKey);
    });

  fieldsRequestPromises.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function mapFields(
  uuids: string[],
  context: OnesWebContext
): Promise<Record<string, OnesField>> {
  if (uuids.length === 0) {
    return {};
  }

  const uniqueUUIDs = new Set(uuids);
  const fields = await listFields(context);

  return fields.reduce<Record<string, OnesField>>((result, field) => {
    if (uniqueUUIDs.has(field.uuid)) {
      result[field.uuid] = field;
    }

    return result;
  }, {});
}
