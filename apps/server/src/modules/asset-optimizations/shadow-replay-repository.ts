import type {
  ShadowReplayRun,
  ShadowReplaySampleResult,
  ShadowReplayStatus
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'shadow_replay_run';
const TEAM_INDEX = 'idx_team_uuid';
const CANDIDATE_INDEX = 'idx_candidate_uuid';
const store = createEntityStore<StoredShadowReplayRun>(ENTITY_NAME);

interface StoredShadowReplayRun {
  team_uuid: string;
  uuid: string;
  candidate_uuid: string;
  agent_uuid: string;
  agent_name: string;
  agent_version: number;
  status: string;
  sample_count: number;
  passed_count: number;
  total_tokens: number;
  tokens_known: boolean;
  results_object_key: string;
  error_message: string;
  created_by: string;
  created_at: number;
  completed_at: number;
}

export interface ShadowReplayRunRecord {
  teamUUID: string;
  uuid: string;
  candidateUUID: string;
  agentUUID: string;
  agentName: string;
  agentVersion: number;
  status: ShadowReplayStatus;
  sampleCount: number;
  passedCount: number;
  totalTokens: number | null;
  resultsObjectKey: string;
  errorMessage: string | null;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface PersistedShadowReplaySampleResult extends ShadowReplaySampleResult {
  modelOutput: string;
}

function key(uuid: string): string {
  return `shadow_replay_${uuid.replaceAll('-', '')}`;
}

function resultsKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey('shadow-replay', teamUUID, uuid, 'results.json');
}

function toRecord(value: StoredShadowReplayRun): ShadowReplayRunRecord {
  return {
    teamUUID: value.team_uuid,
    uuid: value.uuid,
    candidateUUID: value.candidate_uuid,
    agentUUID: value.agent_uuid,
    agentName: value.agent_name,
    agentVersion: value.agent_version,
    status: value.status as ShadowReplayStatus,
    sampleCount: value.sample_count,
    passedCount: value.passed_count,
    totalTokens: value.tokens_known ? value.total_tokens : null,
    resultsObjectKey: value.results_object_key,
    errorMessage: value.error_message || null,
    createdBy: value.created_by,
    createdAt: new Date(value.created_at),
    completedAt: value.completed_at > 0 ? new Date(value.completed_at) : null
  };
}

export async function createShadowReplayRun(input: {
  teamUUID: string;
  uuid: string;
  candidateUUID: string;
  agentUUID: string;
  agentName: string;
  agentVersion: number;
  createdBy: string;
}): Promise<ShadowReplayRunRecord> {
  const now = Date.now();
  const value: StoredShadowReplayRun = {
    team_uuid: input.teamUUID,
    uuid: input.uuid,
    candidate_uuid: input.candidateUUID,
    agent_uuid: input.agentUUID,
    agent_name: input.agentName,
    agent_version: input.agentVersion,
    status: 'running',
    sample_count: 0,
    passed_count: 0,
    total_tokens: 0,
    tokens_known: false,
    results_object_key: resultsKey(input.teamUUID, input.uuid),
    error_message: '',
    created_by: input.createdBy,
    created_at: now,
    completed_at: 0
  };
  await Promise.all([
    store.set(key(input.uuid), value),
    uploadObjectJson(value.results_object_key, [])
  ]);
  return toRecord(value);
}

export async function updateShadowReplayRun(
  record: ShadowReplayRunRecord,
  patch: {
    status: ShadowReplayStatus;
    results?: PersistedShadowReplaySampleResult[];
    errorMessage?: string | null;
  }
): Promise<ShadowReplayRunRecord> {
  const current = await store.get(key(record.uuid));
  if (!current || current.team_uuid !== record.teamUUID) {
    throw new Error(`Shadow replay run not found: ${record.uuid}`);
  }
  const results = patch.results ?? [];
  const tokenValues = results.flatMap((result) => [
    result.usage?.inputTokens,
    result.usage?.outputTokens
  ]);
  const tokensKnown =
    results.length > 0 &&
    tokenValues.every((value) => typeof value === 'number');
  const next: StoredShadowReplayRun = {
    ...current,
    status: patch.status,
    sample_count: results.length || current.sample_count,
    passed_count:
      results.length > 0
        ? results.filter((result) => result.status === 'passed').length
        : current.passed_count,
    total_tokens: tokensKnown
      ? tokenValues.reduce<number>((total, value) => total + Number(value), 0)
      : 0,
    tokens_known: tokensKnown,
    error_message:
      patch.errorMessage === undefined
        ? current.error_message
        : (patch.errorMessage ?? ''),
    completed_at: patch.status === 'running' ? 0 : Date.now()
  };
  await Promise.all([
    store.set(key(record.uuid), next),
    ...(patch.results
      ? [uploadObjectJson(current.results_object_key, patch.results)]
      : [])
  ]);
  return toRecord(next);
}

export async function findShadowReplayRun(
  uuid: string,
  teamUUID: string
): Promise<ShadowReplayRunRecord | null> {
  const value = await store.get(key(uuid));
  return value?.team_uuid === teamUUID ? toRecord(value) : null;
}

export async function findLatestShadowReplayByCandidate(
  candidateUUID: string,
  teamUUID: string
): Promise<ShadowReplayRunRecord | null> {
  const values = (
    await store.queryByIndexEqualTo(
      CANDIDATE_INDEX,
      'candidate_uuid',
      candidateUUID
    )
  )
    .map((entry) => entry.value)
    .filter((entry) => entry.team_uuid === teamUUID)
    .sort((left, right) => right.created_at - left.created_at);
  return values[0] ? toRecord(values[0]) : null;
}

export async function listShadowReplayRuns(
  teamUUID: string
): Promise<ShadowReplayRunRecord[]> {
  return (await store.queryByIndexEqualTo(TEAM_INDEX, 'team_uuid', teamUUID))
    .map((entry) => entry.value)
    .sort((left, right) => right.created_at - left.created_at)
    .map(toRecord);
}

export async function toShadowReplayRun(
  record: ShadowReplayRunRecord
): Promise<ShadowReplayRun> {
  const results =
    (await readObjectJson<PersistedShadowReplaySampleResult[]>(
      record.resultsObjectKey
    )) ?? [];
  return {
    uuid: record.uuid,
    candidateUUID: record.candidateUUID,
    agent: { uuid: record.agentUUID, name: record.agentName },
    agentVersion: record.agentVersion,
    status: record.status,
    sampleCount: record.sampleCount,
    passedCount: record.passedCount,
    totalTokens: record.totalTokens,
    errorMessage: record.errorMessage,
    results: results.map((result) => ({
      sampleUUID: result.sampleUUID,
      status: result.status,
      deterministicPassed: result.deterministicPassed,
      deterministicErrors: result.deterministicErrors,
      review: result.review,
      durationMs: result.durationMs,
      usage: result.usage
    })),
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null
  };
}
