import { randomUUID } from 'node:crypto';
import type {
  AssetCandidateType,
  AssetEffectSnapshot,
  AssetOptimizationMetrics,
  AssetRelease
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'asset_release';
const CANDIDATE_INDEX = 'idx_candidate_uuid';
const AGENT_INDEX = 'idx_agent_uuid';
const store = createEntityStore<StoredAssetRelease>(ENTITY_NAME);

interface StoredAssetRelease {
  team_uuid: string;
  uuid: string;
  candidate_uuid: string;
  agent_uuid: string;
  asset_type: string;
  asset_uuid: string;
  base_version: number;
  published_version: number;
  status: string;
  baseline_object_key: string;
  effect_object_key: string;
  rollback_object_key: string;
  published_by: string;
  published_at: number;
  created_at: number;
  updated_at: number;
}

export interface AssetReleaseRecord {
  teamUUID: string;
  uuid: string;
  candidateUUID: string;
  agentUUID: string;
  assetType: AssetCandidateType;
  assetUUID: string | null;
  baseVersion: number;
  publishedVersion: number | null;
  status: AssetRelease['status'];
  baselineObjectKey: string;
  effectObjectKey: string;
  rollbackObjectKey: string;
  publishedBy: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetOutcomeRates {
  revisionRate: number | null;
  knowledgeHitRate: number | null;
  wikiWriteSuccessRate: number | null;
  acceptancePassRate: number | null;
}

export interface AssetReleaseBaseline {
  metrics: AssetOptimizationMetrics;
  outcomes: AssetOutcomeRates;
}

function key(uuid: string): string {
  return `asset_release_${uuid.replaceAll('-', '')}`;
}

function objectKey(teamUUID: string, uuid: string, name: string): string {
  return buildHostedObjectKey('asset-release', teamUUID, uuid, name);
}

function toRecord(value: StoredAssetRelease): AssetReleaseRecord {
  return {
    teamUUID: value.team_uuid,
    uuid: value.uuid,
    candidateUUID: value.candidate_uuid,
    agentUUID: value.agent_uuid,
    assetType: value.asset_type as AssetCandidateType,
    assetUUID: value.asset_uuid || null,
    baseVersion: value.base_version,
    publishedVersion:
      value.published_version > 0 ? value.published_version : null,
    status: value.status as AssetRelease['status'],
    baselineObjectKey: value.baseline_object_key,
    effectObjectKey: value.effect_object_key,
    rollbackObjectKey: value.rollback_object_key,
    publishedBy: value.published_by,
    publishedAt: value.published_at > 0 ? new Date(value.published_at) : null,
    createdAt: new Date(value.created_at),
    updatedAt: new Date(value.updated_at)
  };
}

export async function createAssetRelease(input: {
  teamUUID: string;
  candidateUUID: string;
  agentUUID: string;
  assetType: AssetCandidateType;
  assetUUID: string | null;
  baseVersion: number;
  publishedVersion: number | null;
  status: AssetRelease['status'];
  baseline: AssetReleaseBaseline;
  publishedBy: string;
}): Promise<AssetReleaseRecord> {
  const existing = await findAssetReleaseByCandidate(
    input.candidateUUID,
    input.teamUUID
  );
  if (existing) return existing;
  const uuid = randomUUID();
  const now = Date.now();
  const value: StoredAssetRelease = {
    team_uuid: input.teamUUID,
    uuid,
    candidate_uuid: input.candidateUUID,
    agent_uuid: input.agentUUID,
    asset_type: input.assetType,
    asset_uuid: input.assetUUID ?? '',
    base_version: input.baseVersion,
    published_version: input.publishedVersion ?? 0,
    status: input.status,
    baseline_object_key: objectKey(input.teamUUID, uuid, 'baseline.json'),
    effect_object_key: objectKey(input.teamUUID, uuid, 'effect.json'),
    rollback_object_key: objectKey(input.teamUUID, uuid, 'rollback.json'),
    published_by: input.publishedBy,
    published_at: input.status === 'awaiting_publication' ? 0 : now,
    created_at: now,
    updated_at: now
  };
  await Promise.all([
    store.set(key(uuid), value),
    uploadObjectJson(value.baseline_object_key, input.baseline),
    uploadObjectJson(value.effect_object_key, null),
    uploadObjectJson(value.rollback_object_key, null)
  ]);
  return toRecord(value);
}

export async function findAssetReleaseByCandidate(
  candidateUUID: string,
  teamUUID: string
): Promise<AssetReleaseRecord | null> {
  const value = (
    await store.queryByIndexEqualTo(
      CANDIDATE_INDEX,
      'candidate_uuid',
      candidateUUID
    )
  )
    .map((entry) => entry.value)
    .find((entry) => entry.team_uuid === teamUUID);
  return value ? toRecord(value) : null;
}

export async function listAssetReleasesByAgent(
  agentUUID: string,
  teamUUID: string
): Promise<AssetReleaseRecord[]> {
  return (await store.queryByIndexEqualTo(AGENT_INDEX, 'agent_uuid', agentUUID))
    .map((entry) => entry.value)
    .filter((entry) => entry.team_uuid === teamUUID)
    .map(toRecord);
}

export async function updateAssetRelease(
  record: AssetReleaseRecord,
  patch: {
    status?: AssetRelease['status'];
    publishedVersion?: number | null;
    publishedBy?: string;
    publishedAt?: Date | null;
    effect?: AssetEffectSnapshot | null;
    rollback?: unknown;
  }
): Promise<AssetReleaseRecord> {
  const current = await store.get(key(record.uuid));
  if (!current || current.team_uuid !== record.teamUUID) {
    throw new Error(`Asset release not found: ${record.uuid}`);
  }
  const next: StoredAssetRelease = {
    ...current,
    status: patch.status ?? current.status,
    published_version:
      patch.publishedVersion === undefined
        ? current.published_version
        : (patch.publishedVersion ?? 0),
    published_by: patch.publishedBy ?? current.published_by,
    published_at:
      patch.publishedAt === undefined
        ? current.published_at
        : (patch.publishedAt?.getTime() ?? 0),
    updated_at: Date.now()
  };
  await Promise.all([
    store.set(key(record.uuid), next),
    ...(patch.effect !== undefined
      ? [uploadObjectJson(current.effect_object_key, patch.effect)]
      : []),
    ...(patch.rollback !== undefined
      ? [uploadObjectJson(current.rollback_object_key, patch.rollback)]
      : [])
  ]);
  return toRecord(next);
}

export async function toAssetRelease(
  record: AssetReleaseRecord
): Promise<AssetRelease> {
  const [effect, rollback] = await Promise.all([
    readObjectJson<AssetEffectSnapshot>(record.effectObjectKey),
    readObjectJson<unknown>(record.rollbackObjectKey)
  ]);
  return {
    uuid: record.uuid,
    candidateUUID: record.candidateUUID,
    agentUUID: record.agentUUID,
    assetType: record.assetType,
    assetUUID: record.assetUUID,
    baseVersion: record.baseVersion,
    publishedVersion: record.publishedVersion,
    status: record.status,
    effect: effect ?? null,
    rollbackDraftCreated: rollback !== null,
    publishedBy: record.publishedBy,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString()
  };
}

export async function readAssetReleaseBaseline(
  record: AssetReleaseRecord
): Promise<AssetReleaseBaseline> {
  const baseline = await readObjectJson<
    AssetReleaseBaseline | AssetOptimizationMetrics
  >(record.baselineObjectKey);
  if (!baseline) throw new Error('Asset release baseline is missing');
  return 'metrics' in baseline
    ? baseline
    : {
        metrics: baseline,
        outcomes: {
          revisionRate: null,
          knowledgeHitRate: null,
          wikiWriteSuccessRate: null,
          acceptancePassRate: null
        }
      };
}
