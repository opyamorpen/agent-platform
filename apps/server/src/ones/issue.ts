import {
  createOnesInternalApiClient,
  createOnesOpenApiClient
} from './index.js';
import { getLogger } from '../lib/logger.js';
import type {
  OnesInternalPatchIssueFieldValue
} from './internal-api/types.js';
import type {
  OnesOpenApiCreateIssueRequest,
  OnesOpenApiExecuteIssueWorkflowRequest,
  OnesOpenApiFieldOptionQueryRequest,
  OnesOpenApiFieldOptionItem,
  OnesOpenApiFieldValue,
  OnesOpenApiIssueAttachment,
  OnesOpenApiIssueComment,
  OnesOpenApiIssueCommentOwner,
  OnesOpenApiIssueDetails,
  OnesOpenApiSendIssueCommentRequest,
  OnesOpenApiUploadIssueAttachmentRequest,
  OnesOpenApiIssueWorkflow,
  OnesOpenApiIssueStatus,
  OnesOpenApiUser
} from './open-api/types.js';
import type {
  OnesInternalApiContext,
  OnesOpenApiContext
} from './context.js';
import { z } from 'zod';

const logger = getLogger('ones.issue');

const ISSUE_TITLE_FIELD_UUID = 'field001';
const ISSUE_ASSIGNEE_FIELD_UUID = 'field004';
const ISSUE_STATUS_FIELD_UUID = 'field005';
const ISSUE_PROJECT_FIELD_UUID = 'field006';
const ISSUE_TYPE_FIELD_UUID = 'field007';
export const ISSUE_DISPLAY_ID_FIELD_UUID = 'field903';
const ISSUE_UPDATED_AT_FIELD_UUID = 'field010';
const ONESQL_CURSOR_OFFSET = 1000;
const ISSUE_COMMENT_FETCH_LIMIT = 100;
const ISSUE_ATTACHMENT_FETCH_LIMIT = 100;

const VALUE_TYPE_TEXT = 'text';
const VALUE_TYPE_MULTI_LINE_TEXT = 'multi_line_text';
const VALUE_TYPE_RICHTEXT = 'richtext';
const VALUE_TYPE_FLOAT = 'float';
const VALUE_TYPE_INTEGER = 'integer';
const VALUE_TYPE_SINGLE_REFERENCE_OBJECT = 'single_reference_object';
const VALUE_TYPE_MULTI_REFERENCE_OBJECT = 'multi_reference_object';
const VALUE_TYPE_DATE = 'date';
const VALUE_TYPE_DATETIME = 'datetime';
const VALUE_TYPE_DURATION_HOUR = 'duration_hour';
const VALUE_TYPE_DURATION_SECOND = 'duration_second';

export const ISSUE_COMMENT_FIELD_UUID = 'field057';
export const ISSUE_COMMENT_FIELD_NAME = '评论';
export const ISSUE_COMMENT_FIELD_TYPE = 'issue_comment';
export const ISSUE_COMMENT_FIELD_VALUE_TYPE = VALUE_TYPE_MULTI_REFERENCE_OBJECT;
export const ISSUE_COMMENT_FIELD_REFERENCE_OBJECT_TYPE = 'comment';
export const ISSUE_ATTACHMENT_FIELD_UUID = 'field047';
export const ISSUE_ATTACHMENT_FIELD_NAME = '附件';
export const ISSUE_ATTACHMENT_FIELD_TYPE = 'issue_attachment';
export const ISSUE_ATTACHMENT_FIELD_VALUE_TYPE = VALUE_TYPE_MULTI_LINE_TEXT;

const onesIssueSchema = z.object({
  uuid: z.string().min(1),
  displayId: z.string(),
  name: z.string().min(1),
  project: z.object({
    uuid: z.string().min(1),
    name: z.string().min(1)
  }),
  issueType: z.object({
    uuid: z.string().min(1),
    name: z.string().min(1)
  }),
  status: z.object({
    uuid: z.string().min(1),
    name: z.string().min(1)
  }),
  assignee: z.object({
    uuid: z.string().min(1),
    name: z.string().min(1)
  })
});

export type OnesIssue = z.infer<typeof onesIssueSchema>;

export interface OnesIssueFieldQuerySpec {
  uuid: string;
  alias: string;
  valueType: string;
  referenceObjectType?: string | null;
}

export interface ListAssignedIssuesFilter {
  projectUUID: string;
  issueTypeUUID: string;
  statusUUID: string;
}

export interface ListAssignedIssuesOptions {
  filters?: ListAssignedIssuesFilter[];
  limit?: number;
}

export function buildListAssignedIssuesQuery(
  assigneeUUIDs: string[],
  limit: number,
  filters: ListAssignedIssuesFilter[] = []
): string {
  const normalizedAssigneeUUIDs = Array.from(
    new Set(
      assigneeUUIDs.map((assigneeUUID) => assigneeUUID.trim()).filter(Boolean)
    )
  );
  const normalizedFilters = Array.from(
    new Map(
      filters
        .map((filter) => ({
          projectUUID: filter.projectUUID.trim(),
          issueTypeUUID: filter.issueTypeUUID.trim(),
          statusUUID: filter.statusUUID.trim()
        }))
        .filter(
          (filter) =>
            filter.projectUUID &&
            filter.issueTypeUUID &&
            filter.statusUUID
        )
        .map((filter) => [
          `${filter.projectUUID}:${filter.issueTypeUUID}:${filter.statusUUID}`,
          filter
        ])
    ).values()
  );

  if (normalizedAssigneeUUIDs.length === 0) {
    throw new Error('At least one assignee UUID is required');
  }

  const assigneeClause = normalizedAssigneeUUIDs
    .map((assigneeUUID) => `'${escapeOneSqlString(assigneeUUID)}'`)
    .join(', ');
  const filterClause =
    normalizedFilters.length === 0
      ? null
      : normalizedFilters
          .map(
            (filter) =>
              [
                '(',
                `uid(${ISSUE_PROJECT_FIELD_UUID}) = '${escapeOneSqlString(filter.projectUUID)}'`,
                `AND uid(${ISSUE_TYPE_FIELD_UUID}) = '${escapeOneSqlString(filter.issueTypeUUID)}'`,
                `AND uid(${ISSUE_STATUS_FIELD_UUID}) = '${escapeOneSqlString(filter.statusUUID)}'`,
                ')'
              ].join(' ')
          )
          .join(' OR ');

  return [
    'SELECT',
    [
      'uuid',
      `${ISSUE_DISPLAY_ID_FIELD_UUID} AS displayId`,
      `${ISSUE_TITLE_FIELD_UUID} AS name`,
      `${ISSUE_PROJECT_FIELD_UUID}.uuid`,
      `${ISSUE_PROJECT_FIELD_UUID}.name`,
      `${ISSUE_TYPE_FIELD_UUID}.uuid`,
      `${ISSUE_TYPE_FIELD_UUID}.name`,
      `${ISSUE_STATUS_FIELD_UUID}.uuid`,
      `${ISSUE_STATUS_FIELD_UUID}.name`,
      `${ISSUE_ASSIGNEE_FIELD_UUID}.uuid`,
      `${ISSUE_ASSIGNEE_FIELD_UUID}.name`
    ].join(', '),
    'FROM issue',
    `WHERE uid(${ISSUE_ASSIGNEE_FIELD_UUID}) IN (${assigneeClause})`,
    ...(filterClause ? [`AND (${filterClause})`] : []),
    "AND v$cursor > ''",
    `ORDER BY ${ISSUE_UPDATED_AT_FIELD_UUID} DESC`,
    `LIMIT ${ONESQL_CURSOR_OFFSET}, ${limit}`
  ].join(' ');
}

function buildFindIssueByDisplayIdQuery(displayId: string): string {
  return [
    'SELECT',
    [
      'uuid',
      `${ISSUE_DISPLAY_ID_FIELD_UUID} AS displayId`,
      `${ISSUE_TITLE_FIELD_UUID} AS name`,
      `${ISSUE_PROJECT_FIELD_UUID}.uuid`,
      `${ISSUE_PROJECT_FIELD_UUID}.name`,
      `${ISSUE_TYPE_FIELD_UUID}.uuid`,
      `${ISSUE_TYPE_FIELD_UUID}.name`,
      `${ISSUE_STATUS_FIELD_UUID}.uuid`,
      `${ISSUE_STATUS_FIELD_UUID}.name`,
      `${ISSUE_ASSIGNEE_FIELD_UUID}.uuid`,
      `${ISSUE_ASSIGNEE_FIELD_UUID}.name`
    ].join(', '),
    'FROM issue',
    `WHERE ${ISSUE_DISPLAY_ID_FIELD_UUID} = '${escapeOneSqlString(displayId)}'`,
    'LIMIT 2'
  ].join(' ');
}

function escapeOneSqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function isScalarValueType(valueType: string): boolean {
  return [
    VALUE_TYPE_TEXT,
    VALUE_TYPE_MULTI_LINE_TEXT,
    VALUE_TYPE_RICHTEXT,
    VALUE_TYPE_FLOAT,
    VALUE_TYPE_INTEGER,
    VALUE_TYPE_DATE,
    VALUE_TYPE_DATETIME,
    VALUE_TYPE_DURATION_HOUR,
    VALUE_TYPE_DURATION_SECOND
  ].includes(valueType);
}

function isSingleReferenceValueType(valueType: string): boolean {
  return valueType === VALUE_TYPE_SINGLE_REFERENCE_OBJECT;
}

function isMultiReferenceValueType(valueType: string): boolean {
  return valueType === VALUE_TYPE_MULTI_REFERENCE_OBJECT;
}

function buildIssueFieldSelectExpressions(field: OnesIssueFieldQuerySpec): string[] {
  if (
    isSingleReferenceValueType(field.valueType) ||
    isMultiReferenceValueType(field.valueType)
  ) {
    return [`${field.uuid}.uuid`, `${field.uuid}.name`];
  }

  if (isScalarValueType(field.valueType)) {
    return [field.uuid];
  }

  throw new Error(`Unsupported ONES field value type: ${field.valueType}`);
}

function buildIssueFieldValuesQuery(
  issueUUID: string,
  fields: OnesIssueFieldQuerySpec[]
): string {
  const selectClause = fields
    .flatMap((field) => buildIssueFieldSelectExpressions(field))
    .join(', ');

  return [
    'SELECT',
    selectClause,
    'FROM issue',
    `WHERE uuid = '${escapeOneSqlString(issueUUID)}'`,
    'LIMIT 1'
  ].join(' ');
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toRefObject(value: unknown) {
  const record = toRecord(value);

  if (!record || typeof record.uuid !== 'string' || typeof record.name !== 'string') {
    return null;
  }

  return {
    uuid: record.uuid,
    name: record.name
  };
}

function toAttachmentRefObject(attachment: OnesOpenApiIssueAttachment): {
  objectType: 'attachment';
  uuid: string;
  name: string;
  fields: Array<{
    fieldUUID: string;
    fieldName: string;
    fieldValueType: string;
    fieldReferenceObjectType?: string | null;
    description: string;
    value: unknown;
  }>;
} {
  return {
    objectType: 'attachment',
    uuid: attachment.id,
    name: attachment.name,
    fields: [
      {
        fieldUUID: 'download_url',
        fieldName: '下载地址',
        fieldValueType: VALUE_TYPE_TEXT,
        description: '附件下载地址，可直接下载附件内容。',
        value: attachment.tempURL.trim()
      },
      {
        fieldUUID: 'created_at',
        fieldName: '上传时间',
        fieldValueType: VALUE_TYPE_DATETIME,
        description: '附件上传时间。',
        value: normalizeDatetimeValue(attachment.createTime)
      },
      {
        fieldUUID: 'creator',
        fieldName: '创建者',
        fieldValueType: VALUE_TYPE_SINGLE_REFERENCE_OBJECT,
        fieldReferenceObjectType: 'user',
        description: '附件创建者。',
        value: toUserRefObject(attachment.creator)
      }
    ]
  };
}

function toUserRefObject(owner?: {
  id?: string;
  name?: string;
}): {
  objectType: 'user';
  uuid: string;
  name: string;
} | null {
  const uuid = owner?.id?.trim();
  const name = owner?.name?.trim();

  if (!uuid || !name) {
    return null;
  }

  return {
    objectType: 'user',
    uuid,
    name
  };
}

function normalizeDatetimeValue(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return normalizedValue;
  }

  let timestampMs = numericValue;

  if (Math.abs(numericValue) >= 1e15) {
    timestampMs = numericValue / 1000;
  } else if (Math.abs(numericValue) < 1e11) {
    timestampMs = numericValue * 1000;
  }

  const date = new Date(timestampMs);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  return date.toISOString();
}

function toCommentRefObject(comment: OnesOpenApiIssueComment): {
  objectType: 'comment';
  uuid: string;
  name: string;
  fields: Array<{
    fieldUUID: string;
    fieldName: string;
    fieldValueType: string;
    fieldReferenceObjectType?: string | null;
    description: string;
    value: unknown;
  }>;
} {
  const authorName = comment.owner?.name?.trim();
  const sendTimeLabel = formatCommentSendTime(comment.createTime);
  const objectName =
    [authorName, sendTimeLabel].filter(Boolean).join(' | ') || comment.id;

  return {
    objectType: 'comment',
    uuid: comment.id,
    name: objectName,
    fields: [
      {
        fieldUUID: 'author',
        fieldName: '作者',
        fieldValueType: VALUE_TYPE_SINGLE_REFERENCE_OBJECT,
        fieldReferenceObjectType: 'user',
        description: '评论作者。',
        value: toUserRefObject(comment.owner)
      },
      {
        fieldUUID: 'created_at',
        fieldName: '发布时间',
        fieldValueType: VALUE_TYPE_DATETIME,
        description: '评论发布时间。',
        value: normalizeDatetimeValue(comment.createTime)
      },
      {
        fieldUUID: 'content',
        fieldName: '内容',
        fieldValueType: VALUE_TYPE_RICHTEXT,
        description: '评论正文。',
        value: comment.text.trim()
      }
    ]
  };
}

function normalizeScalarIssueFieldValue(value: unknown): unknown {
  return value === null ? null : value;
}

function normalizeMultiRefObjectValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const refObject = toRefObject(item);

    return refObject ? [refObject] : [];
  });
}

function extractRichCommentBody(richText: string): string {
  const trimmedRichText = richText.trim();

  if (!trimmedRichText) {
    return '';
  }

  const bodyMatch = trimmedRichText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  return (bodyMatch?.[1] ?? trimmedRichText).trim();
}

function padTimestampPart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatCommentSendTime(sendTime?: string): string | undefined {
  if (!sendTime) {
    return undefined;
  }

  const normalizedValue = sendTime.trim();

  if (!normalizedValue) {
    return undefined;
  }

  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return normalizedValue;
  }

  let timestampMs = numericValue;

  if (Math.abs(numericValue) >= 1e15) {
    timestampMs = numericValue / 1000;
  } else if (Math.abs(numericValue) < 1e11) {
    timestampMs = numericValue * 1000;
  }

  const date = new Date(timestampMs);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  return [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate())
  ].join('-')
    + ` ${padTimestampPart(date.getHours())}:${padTimestampPart(date.getMinutes())}:${padTimestampPart(date.getSeconds())}`;
}

function formatIssueComment(comment: OnesOpenApiIssueComment): string {
  const metadata = [formatCommentSendTime(comment.createTime), comment.owner?.name]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' | ');
  const header = metadata || comment.id;
  const text = comment.text.trim();

  return `【${header}】\n${text}`;
}

function formatIssueAttachment(attachment: OnesOpenApiIssueAttachment): string {
  return [
    `id: ${attachment.id}`,
    `name: ${attachment.name}`,
    `downloadUrl: ${attachment.tempURL}`
  ].join('\n');
}

async function listIssueAttachments(
  issueUUID: string,
  context: OnesOpenApiContext,
  limit: number = ISSUE_ATTACHMENT_FETCH_LIMIT
): Promise<OnesOpenApiIssueAttachment[]> {
  const normalizedLimit = Math.max(0, Math.trunc(limit));

  if (normalizedLimit === 0) {
    return [];
  }

  const attachments: OnesOpenApiIssueAttachment[] = [];
  let cursor: string | undefined;

  while (attachments.length < normalizedLimit) {
    const remaining = normalizedLimit - attachments.length;
    const result = await (
      await createOnesOpenApiClient(context)
    ).listIssueAttachments(issueUUID, {
      limit: Math.min(remaining, 100),
      cursor
    });

    attachments.push(...result.list.slice(0, remaining));

    if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) {
      break;
    }

    cursor = result.pageInfo.endCursor;
  }

  return attachments;
}

async function getIssueCommentsRichText(
  issueUUID: string,
  context: OnesOpenApiContext,
  limit: number
): Promise<string> {
  const comments = await listIssueComments(issueUUID, context, limit);
  return comments.map((comment) => formatIssueComment(comment)).join('\n\n');
}

export async function listIssueComments(
  issueUUID: string,
  context: OnesOpenApiContext,
  limit: number = ISSUE_COMMENT_FETCH_LIMIT
): Promise<OnesOpenApiIssueComment[]> {
  const normalizedLimit = Math.max(0, Math.trunc(limit));

  if (normalizedLimit === 0) {
    return [];
  }

  const comments: OnesOpenApiIssueComment[] = [];
  let cursor: string | undefined;
  const client = await createOnesOpenApiClient(context);

  while (comments.length < normalizedLimit) {
    const remaining = normalizedLimit - comments.length;
    const result = await client.listIssueComments(issueUUID, {
      limit: Math.min(remaining, 100),
      cursor
    });

    comments.push(...result.list.slice(0, remaining));

    if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) {
      break;
    }

    cursor = result.pageInfo.endCursor;
  }

  return comments;
}

function toOnesIssue(item: Record<string, unknown>): OnesIssue | null {
  const project = toRefObject(item[ISSUE_PROJECT_FIELD_UUID]);
  const issueType = toRefObject(item[ISSUE_TYPE_FIELD_UUID]);
  const status = toRefObject(item[ISSUE_STATUS_FIELD_UUID]);
  const assignee = toRefObject(item[ISSUE_ASSIGNEE_FIELD_UUID]);

  const parsedIssue = onesIssueSchema.safeParse({
    uuid: item.uuid,
    displayId: typeof item.displayId === 'string' ? item.displayId : '',
    name: item.name,
    project,
    issueType,
    status,
    assignee
  });

  if (!parsedIssue.success) {
    return null;
  }

  return parsedIssue.data;
}

export async function patchIssueFields(
  issueUUID: string,
  fieldValues: readonly OnesInternalPatchIssueFieldValue[],
  context: OnesInternalApiContext
): Promise<void> {
  await (await createOnesInternalApiClient(context)).patchIssueFields(
    issueUUID,
    fieldValues
  );
}

export async function updateIssueFields(
  issueUUID: string,
  fieldValues: readonly OnesOpenApiFieldValue[],
  context: OnesOpenApiContext
): Promise<void> {
  await (await createOnesOpenApiClient(context)).updateIssue(issueUUID, {
    fieldValues
  });
}

export async function createIssue(
  request: OnesOpenApiCreateIssueRequest,
  context: OnesOpenApiContext
) {
  return (await createOnesOpenApiClient(context)).createIssue(request);
}

export async function listIssueFieldOptions(
  request: OnesOpenApiFieldOptionQueryRequest,
  context: OnesOpenApiContext
): Promise<OnesOpenApiFieldOptionItem[]> {
  const result = await (await createOnesOpenApiClient(context)).listFieldOptions(
    request
  );

  return result.list;
}

export async function searchIssueUsers(
  request: {
    keyword?: string;
    limit?: number;
    cursor?: string;
  },
  context: OnesOpenApiContext
): Promise<OnesOpenApiUser[]> {
  const result = await (await createOnesOpenApiClient(context)).searchUsers(request);

  return result.list;
}

export async function sendIssueComment(
  issueUUID: string,
  request: OnesOpenApiSendIssueCommentRequest,
  context: OnesOpenApiContext
): Promise<void> {
  await (await createOnesOpenApiClient(context)).sendIssueComment(
    issueUUID,
    request
  );
}

export async function uploadIssueAttachment(
  issueUUID: string,
  request: OnesOpenApiUploadIssueAttachmentRequest,
  context: OnesOpenApiContext
): Promise<string> {
  return (await createOnesOpenApiClient(context)).uploadIssueAttachment(
    issueUUID,
    request
  );
}

export async function getIssue(
  issueUUID: string,
  context: OnesOpenApiContext
): Promise<OnesOpenApiIssueDetails> {
  return (await createOnesOpenApiClient(context)).getIssue(issueUUID);
}

export async function listIssueStatuses(
  context: OnesOpenApiContext
): Promise<OnesOpenApiIssueStatus[]> {
  const statuses: OnesOpenApiIssueStatus[] = [];
  let cursor: string | undefined;

  while (true) {
    const result = await (await createOnesOpenApiClient(context)).listIssueStatuses({
      limit: 500,
      cursor
    });

    statuses.push(...result.list);

    if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) {
      break;
    }

    cursor = result.pageInfo.endCursor;
  }

  return statuses;
}

export async function listExecutableIssueWorkflows(
  issueUUID: string,
  context: OnesOpenApiContext
): Promise<OnesOpenApiIssueWorkflow[]> {
  return (await createOnesOpenApiClient(context)).listExecutableIssueWorkflows(
    issueUUID
  );
}

export async function getIssueCommentsText(
  issueUUID: string,
  context: OnesOpenApiContext,
  limit: number = ISSUE_COMMENT_FETCH_LIMIT
): Promise<string> {
  const normalizedLimit = Math.max(0, Math.trunc(limit));

  if (normalizedLimit === 0) {
    return '';
  }

  return getIssueCommentsRichText(issueUUID, context, normalizedLimit);
}

export async function getIssueAttachmentsText(
  issueUUID: string,
  context: OnesOpenApiContext,
  limit: number = ISSUE_ATTACHMENT_FETCH_LIMIT
): Promise<string> {
  const attachments = await listIssueAttachments(issueUUID, context, limit);

  return attachments.map((attachment) => formatIssueAttachment(attachment)).join('\n\n');
}

export async function executeIssueWorkflow(
  issueUUID: string,
  request: OnesOpenApiExecuteIssueWorkflowRequest,
  context: OnesOpenApiContext
): Promise<void> {
  await (await createOnesOpenApiClient(context)).executeIssueWorkflow(
    issueUUID,
    request
  );
}

export async function getIssueFieldValues(
  issueUUID: string,
  fields: OnesIssueFieldQuerySpec[],
  context: OnesOpenApiContext
): Promise<Record<string, unknown> | null> {
  if (fields.length === 0) {
    return {};
  }

  const queryFields = fields.filter(
    (field) =>
      field.uuid !== ISSUE_COMMENT_FIELD_UUID &&
      field.uuid !== ISSUE_ATTACHMENT_FIELD_UUID &&
      field.referenceObjectType !== 'attachment'
  );
  let rowItem: Record<string, unknown> | null = {};

  if (queryFields.length > 0) {
    const result = await (await createOnesOpenApiClient(context)).executeOneSQL(
      buildIssueFieldValuesQuery(issueUUID, queryFields)
    );
    const row = result.rows[0];

    if (!row?.item) {
      return null;
    }

    rowItem = row.item;
  }

  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.uuid === ISSUE_COMMENT_FIELD_UUID) {
      values[field.alias] = (await listIssueComments(issueUUID, context)).map(
        (comment) => toCommentRefObject(comment)
      );
      continue;
    }

    if (
      field.uuid === ISSUE_ATTACHMENT_FIELD_UUID ||
      field.referenceObjectType === 'attachment'
    ) {
      values[field.alias] = (
        await listIssueAttachments(issueUUID, context)
      ).map((attachment) => toAttachmentRefObject(attachment));
      continue;
    }

    const rawValue = rowItem[field.uuid];

    if (isSingleReferenceValueType(field.valueType)) {
      values[field.alias] = toRefObject(rawValue);
      continue;
    }

    if (isMultiReferenceValueType(field.valueType)) {
      values[field.alias] = normalizeMultiRefObjectValue(rawValue);
      continue;
    }

    if (isScalarValueType(field.valueType)) {
      values[field.alias] = normalizeScalarIssueFieldValue(rawValue);
      continue;
    }

    throw new Error(`Unsupported ONES field value type: ${field.valueType}`);
  }

  return values;
}

export async function listAssignedIssues(
  context: OnesOpenApiContext,
  assigneeUUIDs: string[],
  options: ListAssignedIssuesOptions = {}
): Promise<OnesIssue[]> {
  if (assigneeUUIDs.length === 0) {
    return [];
  }

  const limit = options.limit ?? 200;
  const result = await (await createOnesOpenApiClient(context)).executeOneSQL(
    buildListAssignedIssuesQuery(assigneeUUIDs, limit, options.filters ?? [])
  );

  const issues = result.rows
    .flatMap((row) => {
      if (!row.item) {
        return [];
      }

      const issue = toOnesIssue(row.item);

      if (!issue) {
        logger.error(
          '[workflow-execution] skip invalid ONES issue payload',
          row.item
        );
        return [];
      }

      return [issue];
    })
    .slice(0, limit);

  if (result.rows.length > limit) {
    logger.warn('[workflow-execution] ONES issue query result was truncated', {
      requestedLimit: limit,
      receivedCount: result.rows.length
    });
  }

  return issues;
}

export async function findIssueByDisplayId(
  context: OnesOpenApiContext,
  displayId: string
): Promise<OnesIssue | null> {
  const normalizedDisplayId = displayId.trim();

  if (!normalizedDisplayId) {
    return null;
  }

  const result = await (await createOnesOpenApiClient(context)).executeOneSQL(
    buildFindIssueByDisplayIdQuery(normalizedDisplayId)
  );

  const issues = result.rows.flatMap((row) => {
    if (!row.item) {
      return [];
    }

    const issue = toOnesIssue(row.item);

    if (!issue) {
      logger.error(
        '[workflow-execution] skip invalid ONES issue payload when resolving displayId',
        row.item
      );
      return [];
    }

    return [issue];
  });

  if (issues.length === 0) {
    return null;
  }

  if (issues.length > 1) {
    throw new Error(
      `ONES displayId "${normalizedDisplayId}" matched multiple issues`
    );
  }

  return issues[0];
}
