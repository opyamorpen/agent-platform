import type {
  AssetCandidateContent,
  AssetCandidateStatus,
  AssetCandidateType,
  AssetOptimizationMetrics,
  AssetOptimizationRunStatus,
  AssetOptimizationTrigger,
  AssetReplayScore
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  readObjectJson,
  type HostedEntityEntry,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

const RUN_ENTITY_NAME = 'asset_optimization_run';
const CANDIDATE_ENTITY_NAME = 'asset_candidate';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const RUN_UUID_INDEX_NAME = 'idx_run_uuid';
const TRIGGER_SIGNATURE_INDEX_NAME = 'idx_trigger_signature';

const runStore = createEntityStore<StoredRunEntity>(RUN_ENTITY_NAME);
const candidateStore = createEntityStore<StoredCandidateEntity>(
  CANDIDATE_ENTITY_NAME
);

export class AssetCandidateRevisionConflictError extends Error {
  constructor() {
    super('Asset candidate changed in another request');
    this.name = 'AssetCandidateRevisionConflictError';
  }
}

export interface AssetOptimizationRunRecord {
  teamUUID: string;
  uuid: string;
  agentUUID: string;
  agentName: string;
  agentVersion: number;
  trigger: AssetOptimizationTrigger;
  triggerSignature: string;
  status: AssetOptimizationRunStatus;
  sampleObjectKey: string;
  replayObjectKey: string;
  metrics: AssetOptimizationMetrics;
  createdBy: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface AssetCandidateRecord {
  teamUUID: string;
  uuid: string;
  runUUID: string;
  type: AssetCandidateType;
  status: AssetCandidateStatus;
  title: string;
  summary: string;
  targetUUID: string | null;
  baseRevision: number;
  contentObjectKey: string;
  hasScripts: boolean;
  conflictReason: string | null;
  appliedAssetUUID: string | null;
  createdBy: string;
  appliedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredRunEntity {
  team_uuid: string;
  uuid: string;
  agent_uuid: string;
  agent_name: string;
  agent_version: number;
  trigger: string;
  trigger_signature: string;
  status: string;
  sample_object_key: string;
  replay_object_key: string;
  sample_count: number;
  success_count: number;
  /** Historical manifest fields retained for Hosted Storage compatibility. */
  failure_count: number;
  blocked_count: number;
  problem_count: number;
  retry_count: number;
  average_attempts: number;
  replay_sample_count: number;
  total_tokens: number;
  tokens_known: boolean;
  created_by: string;
  error_message: string;
  created_at: number;
  updated_at: number;
  completed_at: number;
}

interface StoredCandidateEntity {
  team_uuid: string;
  uuid: string;
  run_uuid: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  target_uuid: string;
  base_revision: number;
  content_object_key: string;
  has_scripts: boolean;
  conflict_reason: string;
  applied_asset_uuid: string;
  created_by: string;
  applied_by: string;
  created_at: number;
  updated_at: number;
}

export function resolveAssetOptimizationRunCompatibilityFields(current?: {
  failure_count?: unknown;
  blocked_count?: unknown;
}): Pick<StoredRunEntity, 'failure_count' | 'blocked_count'> {
  return {
    failure_count:
      typeof current?.failure_count === 'number' ? current.failure_count : 0,
    blocked_count:
      typeof current?.blocked_count === 'number' ? current.blocked_count : 0
  };
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/giu, '').toLowerCase();
}

function getRunKey(uuid: string): string {
  return `asset_run_${normalizeKeySegment(uuid)}`;
}

function getCandidateKey(uuid: string): string {
  return `asset_candidate_${normalizeKeySegment(uuid)}`;
}

function getRunObjectPrefix(teamUUID: string, runUUID: string): string {
  return buildHostedObjectKey('asset-optimization', teamUUID, runUUID);
}

export function getRunSampleObjectKey(
  teamUUID: string,
  runUUID: string
): string {
  return buildHostedObjectKey(
    getRunObjectPrefix(teamUUID, runUUID),
    'samples.json'
  );
}

export function getRunReplayObjectKey(
  teamUUID: string,
  runUUID: string
): string {
  return buildHostedObjectKey(
    getRunObjectPrefix(teamUUID, runUUID),
    'replay.json'
  );
}

function getCandidateContentObjectKey(
  teamUUID: string,
  runUUID: string,
  candidateUUID: string
): string {
  return buildHostedObjectKey(
    getRunObjectPrefix(teamUUID, runUUID),
    'candidates',
    `${candidateUUID}.json`
  );
}

function toRunRecord(value: StoredRunEntity): AssetOptimizationRunRecord {
  return {
    teamUUID: value.team_uuid,
    uuid: value.uuid,
    agentUUID: value.agent_uuid,
    agentName: value.agent_name,
    agentVersion: value.agent_version,
    trigger: value.trigger === 'automatic' ? 'automatic' : 'manual',
    triggerSignature: value.trigger_signature,
    status: value.status as AssetOptimizationRunStatus,
    sampleObjectKey: value.sample_object_key,
    replayObjectKey: value.replay_object_key,
    metrics: {
      totalSamples: value.sample_count,
      successCount: value.success_count,
      problemCount: value.problem_count,
      retryCount: value.retry_count,
      averageAttempts: value.average_attempts,
      totalTokens: value.tokens_known ? value.total_tokens : null,
      replaySampleCount: value.replay_sample_count
    },
    createdBy: value.created_by,
    errorMessage: value.error_message || null,
    createdAt: new Date(value.created_at),
    updatedAt: new Date(value.updated_at),
    completedAt: value.completed_at > 0 ? new Date(value.completed_at) : null
  };
}

function toCandidateRecord(value: StoredCandidateEntity): AssetCandidateRecord {
  return {
    teamUUID: value.team_uuid,
    uuid: value.uuid,
    runUUID: value.run_uuid,
    type: value.type as AssetCandidateType,
    status: value.status as AssetCandidateStatus,
    title: value.title,
    summary: value.summary,
    targetUUID: value.target_uuid || null,
    baseRevision: value.base_revision,
    contentObjectKey: value.content_object_key,
    hasScripts: value.has_scripts,
    conflictReason: value.conflict_reason || null,
    appliedAssetUUID: value.applied_asset_uuid || null,
    createdBy: value.created_by,
    appliedBy: value.applied_by || null,
    createdAt: new Date(value.created_at),
    updatedAt: new Date(value.updated_at)
  };
}

async function listRunEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredRunEntity>>> {
  return runStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

export async function listAssetOptimizationRuns(
  teamUUID: string
): Promise<AssetOptimizationRunRecord[]> {
  return (await listRunEntries(teamUUID))
    .map((entry) => entry.value)
    .sort((left, right) => right.created_at - left.created_at)
    .map(toRunRecord);
}

export async function findAssetOptimizationRun(
  uuid: string,
  teamUUID: string
): Promise<AssetOptimizationRunRecord | null> {
  const value = await runStore.get(getRunKey(uuid));
  return value?.team_uuid === teamUUID ? toRunRecord(value) : null;
}

export async function findAssetOptimizationRunBySignature(
  signature: string,
  teamUUID: string
): Promise<AssetOptimizationRunRecord | null> {
  const entries = await runStore.queryByIndexEqualTo(
    TRIGGER_SIGNATURE_INDEX_NAME,
    'trigger_signature',
    signature
  );
  const value = entries.find(
    (entry) => entry.value.team_uuid === teamUUID
  )?.value;
  return value ? toRunRecord(value) : null;
}

export async function createAssetOptimizationRun(input: {
  teamUUID: string;
  uuid: string;
  agentUUID: string;
  agentName: string;
  agentVersion: number;
  trigger: AssetOptimizationTrigger;
  triggerSignature: string;
  createdBy: string;
}): Promise<AssetOptimizationRunRecord> {
  const now = Date.now();
  const value: StoredRunEntity = {
    team_uuid: input.teamUUID,
    uuid: input.uuid,
    agent_uuid: input.agentUUID,
    agent_name: input.agentName,
    agent_version: input.agentVersion,
    trigger: input.trigger,
    trigger_signature: input.triggerSignature,
    status: 'generating',
    sample_object_key: getRunSampleObjectKey(input.teamUUID, input.uuid),
    replay_object_key: getRunReplayObjectKey(input.teamUUID, input.uuid),
    sample_count: 0,
    success_count: 0,
    ...resolveAssetOptimizationRunCompatibilityFields(),
    problem_count: 0,
    retry_count: 0,
    average_attempts: 0,
    replay_sample_count: 0,
    total_tokens: 0,
    tokens_known: false,
    created_by: input.createdBy,
    error_message: '',
    created_at: now,
    updated_at: now,
    completed_at: 0
  };
  await runStore.set(getRunKey(input.uuid), value);
  return toRunRecord(value);
}

export async function updateAssetOptimizationRun(
  record: AssetOptimizationRunRecord,
  patch: {
    status?: AssetOptimizationRunStatus;
    metrics?: AssetOptimizationMetrics;
    errorMessage?: string | null;
    completedAt?: Date | null;
  }
): Promise<AssetOptimizationRunRecord> {
  const current = await runStore.get(getRunKey(record.uuid));
  if (!current || current.team_uuid !== record.teamUUID) {
    throw new Error(`Asset optimization run not found: ${record.uuid}`);
  }
  const metrics = patch.metrics ?? record.metrics;
  const next: StoredRunEntity = {
    ...current,
    status: patch.status ?? current.status,
    ...resolveAssetOptimizationRunCompatibilityFields(current),
    sample_count: metrics.totalSamples,
    success_count: metrics.successCount,
    problem_count: metrics.problemCount,
    retry_count: metrics.retryCount,
    average_attempts: metrics.averageAttempts,
    replay_sample_count: metrics.replaySampleCount,
    total_tokens: metrics.totalTokens ?? 0,
    tokens_known: metrics.totalTokens !== null,
    error_message:
      patch.errorMessage === undefined
        ? current.error_message
        : (patch.errorMessage ?? ''),
    updated_at: Date.now(),
    completed_at:
      patch.completedAt === undefined
        ? current.completed_at
        : (patch.completedAt?.getTime() ?? 0)
  };
  await runStore.set(getRunKey(record.uuid), next);
  return toRunRecord(next);
}

export async function listAssetCandidatesByRun(
  runUUID: string,
  teamUUID: string
): Promise<AssetCandidateRecord[]> {
  const entries = await candidateStore.queryByIndexEqualTo(
    RUN_UUID_INDEX_NAME,
    'run_uuid',
    runUUID
  );
  return entries
    .map((entry) => entry.value)
    .filter((value) => value.team_uuid === teamUUID)
    .sort((left, right) => left.created_at - right.created_at)
    .map(toCandidateRecord);
}

export async function findAssetCandidate(
  uuid: string,
  teamUUID: string
): Promise<AssetCandidateRecord | null> {
  const value = await candidateStore.get(getCandidateKey(uuid));
  return value?.team_uuid === teamUUID ? toCandidateRecord(value) : null;
}

export async function createAssetCandidate(input: {
  teamUUID: string;
  uuid: string;
  runUUID: string;
  type: AssetCandidateType;
  title: string;
  summary: string;
  targetUUID: string | null;
  baseRevision: number;
  content: AssetCandidateContent;
  hasScripts: boolean;
  createdBy: string;
}): Promise<AssetCandidateRecord> {
  const now = Date.now();
  const contentObjectKey = getCandidateContentObjectKey(
    input.teamUUID,
    input.runUUID,
    input.uuid
  );
  await uploadObjectJson(contentObjectKey, input.content);
  const value: StoredCandidateEntity = {
    team_uuid: input.teamUUID,
    uuid: input.uuid,
    run_uuid: input.runUUID,
    type: input.type,
    status: 'draft',
    title: input.title,
    summary: input.summary,
    target_uuid: input.targetUUID ?? '',
    base_revision: input.baseRevision,
    content_object_key: contentObjectKey,
    has_scripts: input.hasScripts,
    conflict_reason: '',
    applied_asset_uuid: '',
    created_by: input.createdBy,
    applied_by: '',
    created_at: now,
    updated_at: now
  };
  await candidateStore.set(getCandidateKey(input.uuid), value);
  return toCandidateRecord(value);
}

export async function updateAssetCandidate(
  record: AssetCandidateRecord,
  patch: {
    status?: AssetCandidateStatus;
    conflictReason?: string | null;
    appliedAssetUUID?: string | null;
    appliedBy?: string | null;
  },
  expectedUpdatedAt?: Date
): Promise<AssetCandidateRecord> {
  const current = await candidateStore.get(getCandidateKey(record.uuid));
  if (!current || current.team_uuid !== record.teamUUID) {
    throw new Error(`Asset candidate not found: ${record.uuid}`);
  }
  if (expectedUpdatedAt && current.updated_at !== expectedUpdatedAt.getTime()) {
    throw new AssetCandidateRevisionConflictError();
  }
  const next: StoredCandidateEntity = {
    ...current,
    status: patch.status ?? current.status,
    conflict_reason:
      patch.conflictReason === undefined
        ? current.conflict_reason
        : (patch.conflictReason ?? ''),
    applied_asset_uuid:
      patch.appliedAssetUUID === undefined
        ? current.applied_asset_uuid
        : (patch.appliedAssetUUID ?? ''),
    applied_by:
      patch.appliedBy === undefined
        ? current.applied_by
        : (patch.appliedBy ?? ''),
    updated_at: Math.max(Date.now(), current.updated_at + 1)
  };
  await candidateStore.set(getCandidateKey(record.uuid), next);
  return toCandidateRecord(next);
}

export async function readAssetCandidateContent(
  record: AssetCandidateRecord
): Promise<AssetCandidateContent> {
  const content = await readObjectJson<AssetCandidateContent>(
    record.contentObjectKey
  );
  if (!content) {
    throw new Error(`Asset candidate content is missing: ${record.uuid}`);
  }
  return content;
}

export async function writeAssetOptimizationSamples(
  record: AssetOptimizationRunRecord,
  samples: unknown
): Promise<void> {
  await uploadObjectJson(record.sampleObjectKey, samples);
}

export async function writeAssetOptimizationReplay(
  record: AssetOptimizationRunRecord,
  replay: Record<string, AssetReplayScore>
): Promise<void> {
  await uploadObjectJson(record.replayObjectKey, replay);
}

export async function readAssetOptimizationReplay(
  record: AssetOptimizationRunRecord
): Promise<Record<string, AssetReplayScore>> {
  return (
    (await readObjectJson<Record<string, AssetReplayScore>>(
      record.replayObjectKey
    )) ?? {}
  );
}
