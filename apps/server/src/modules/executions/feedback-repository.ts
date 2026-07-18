import { createHash } from 'node:crypto';
import type {
  ExecutionFeedback,
  ExecutionFeedbackSource,
  ExecutionFeedbackStatus
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'execution_feedback';
const ISSUE_EXECUTION_INDEX = 'idx_issue_execution_uuid';
const LOOP_TRACE_INDEX = 'idx_loop_trace_uuid';
const store = createEntityStore<StoredExecutionFeedback>(ENTITY_NAME);

interface StoredExecutionFeedback {
  team_uuid: string;
  uuid: string;
  issue_execution_uuid: string;
  loop_trace_uuid: string;
  dispatched_issue_uuid: string;
  iteration: number;
  comment_uuid: string;
  source: string;
  status: string;
  excerpt: string;
  content_hash: string;
  detail_object_key: string;
  created_at: number;
  updated_at: number;
}

interface ExecutionFeedbackDetail {
  criterionUUIDs: string[];
  resolution: string | null;
  writeTargets: string[];
}

export interface UpsertExecutionFeedbackInput {
  teamUUID: string;
  issueExecutionUUID: string;
  loopTraceUUID: string;
  dispatchedIssueUUID: string;
  iteration: number;
  commentUUID: string | null;
  source: ExecutionFeedbackSource;
  excerpt: string;
  content: string;
  criterionUUIDs?: string[];
}

export function buildFeedbackContentHash(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

function buildFeedbackUUID(input: {
  loopTraceUUID: string;
  source: string;
  externalUUID: string;
  contentHash: string;
}): string {
  const hex = createHash('sha256')
    .update(
      `${input.loopTraceUUID}:${input.source}:${input.externalUUID}:${input.contentHash}`
    )
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function key(uuid: string): string {
  return `execution_feedback_${uuid.replaceAll('-', '')}`;
}

function detailObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    'execution-feedback',
    teamUUID,
    uuid,
    'detail.json'
  );
}

async function readDetail(
  value: StoredExecutionFeedback
): Promise<ExecutionFeedbackDetail> {
  return (
    (await readObjectJson<ExecutionFeedbackDetail>(
      value.detail_object_key
    )) ?? {
      criterionUUIDs: [],
      resolution: null,
      writeTargets: []
    }
  );
}

async function toFeedback(
  value: StoredExecutionFeedback
): Promise<ExecutionFeedback> {
  const detail = await readDetail(value);
  return {
    uuid: value.uuid,
    issueExecutionUUID: value.issue_execution_uuid,
    loopTraceUUID: value.loop_trace_uuid,
    dispatchedIssueUUID: value.dispatched_issue_uuid,
    iteration: Math.max(1, value.iteration || 1),
    commentUUID: value.comment_uuid || null,
    source: value.source as ExecutionFeedbackSource,
    status: value.status as ExecutionFeedbackStatus,
    excerpt: value.excerpt,
    contentHash: value.content_hash,
    criterionUUIDs: detail.criterionUUIDs,
    resolution: detail.resolution,
    writeTargets: detail.writeTargets,
    createdAt: new Date(value.created_at).toISOString(),
    updatedAt: new Date(value.updated_at).toISOString()
  };
}

export async function upsertExecutionFeedback(
  input: UpsertExecutionFeedbackInput
): Promise<ExecutionFeedback> {
  const contentHash = buildFeedbackContentHash(input.content);
  const uuid = buildFeedbackUUID({
    loopTraceUUID: input.loopTraceUUID,
    source: input.source,
    externalUUID: input.commentUUID ?? input.issueExecutionUUID,
    contentHash
  });
  const current = await store.get(key(uuid));
  const currentDetail = current ? await readDetail(current) : null;
  const now = Date.now();
  const detail: ExecutionFeedbackDetail = {
    criterionUUIDs: Array.from(new Set(input.criterionUUIDs ?? [])),
    resolution: currentDetail?.resolution ?? null,
    writeTargets: currentDetail?.writeTargets ?? []
  };
  const value: StoredExecutionFeedback = {
    team_uuid: input.teamUUID,
    uuid,
    issue_execution_uuid: input.issueExecutionUUID,
    loop_trace_uuid: input.loopTraceUUID,
    dispatched_issue_uuid: input.dispatchedIssueUUID,
    iteration: input.iteration,
    comment_uuid: input.commentUUID ?? '',
    source: input.source,
    status: current?.status === 'resolved' ? 'resolved' : ('included' as const),
    excerpt: input.excerpt.replace(/\s+/gu, ' ').trim().slice(0, 512),
    content_hash: contentHash,
    detail_object_key:
      current?.detail_object_key ?? detailObjectKey(input.teamUUID, uuid),
    created_at: current?.created_at ?? now,
    updated_at: now
  };
  await Promise.all([
    store.set(key(uuid), value),
    uploadObjectJson(value.detail_object_key, detail)
  ]);
  return toFeedback(value);
}

async function listByIndex(
  indexName: string,
  attributeName: 'issue_execution_uuid' | 'loop_trace_uuid',
  value: string,
  teamUUID: string
): Promise<ExecutionFeedback[]> {
  const records = (
    await store.queryByIndexEqualTo(indexName, attributeName, value)
  )
    .map((entry) => entry.value)
    .filter((entry) => entry.team_uuid === teamUUID)
    .sort((left, right) => left.created_at - right.created_at);
  return Promise.all(records.map(toFeedback));
}

export function listExecutionFeedbackByExecution(
  issueExecutionUUID: string,
  teamUUID: string
): Promise<ExecutionFeedback[]> {
  return listByIndex(
    ISSUE_EXECUTION_INDEX,
    'issue_execution_uuid',
    issueExecutionUUID,
    teamUUID
  );
}

export function listExecutionFeedbackByTrace(
  loopTraceUUID: string,
  teamUUID: string
): Promise<ExecutionFeedback[]> {
  return listByIndex(
    LOOP_TRACE_INDEX,
    'loop_trace_uuid',
    loopTraceUUID,
    teamUUID
  );
}

export async function resolveExecutionFeedback(
  uuids: string[],
  resolution: string,
  writeTargets: string[],
  teamUUID: string
): Promise<void> {
  await Promise.all(
    Array.from(new Set(uuids)).map(async (uuid) => {
      const current = await store.get(key(uuid));
      if (!current || current.team_uuid !== teamUUID) return;
      const detail = await readDetail(current);
      await Promise.all([
        store.set(key(uuid), {
          ...current,
          status: 'resolved',
          updated_at: Date.now()
        }),
        uploadObjectJson(current.detail_object_key, {
          ...detail,
          resolution: resolution.replace(/\s+/gu, ' ').trim().slice(0, 512),
          writeTargets: Array.from(new Set(writeTargets)).slice(0, 8)
        } satisfies ExecutionFeedbackDetail)
      ]);
    })
  );
}
