import { randomUUID } from 'node:crypto';
import type {
  ExperiencePattern,
  ExperiencePatternType
} from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

const ENTITY_NAME = 'experience_pattern';
const TEAM_INDEX = 'idx_team_uuid';
const PATTERN_INDEX = 'idx_pattern_key';
const store = createEntityStore<StoredExperiencePattern>(ENTITY_NAME);

interface StoredExperiencePattern {
  team_uuid: string;
  uuid: string;
  pattern_key: string;
  type: string;
  agent_uuid: string;
  agent_name: string;
  workflow_uuid: string;
  workflow_name: string;
  issue_type_uuid: string;
  detail_object_key: string;
  evidence_count: number;
  success_count: number;
  confidence: number;
  prompt_enabled: boolean;
  candidate_enabled: boolean;
  runtime_enabled: boolean;
  first_seen_at: number;
  last_seen_at: number;
  expires_at: number;
}

interface ExperiencePatternDetail {
  businessTags: string[];
  title: string;
  repairStrategy: string;
}

function key(uuid: string): string {
  return `experience_pattern_${uuid.replaceAll('-', '')}`;
}

function detailObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    'experience-pattern',
    teamUUID,
    uuid,
    'detail.json'
  );
}

async function readDetail(
  value: StoredExperiencePattern
): Promise<ExperiencePatternDetail> {
  return (
    (await readObjectJson<ExperiencePatternDetail>(
      value.detail_object_key
    )) ?? {
      businessTags: [],
      title: '',
      repairStrategy: ''
    }
  );
}

async function toPattern(
  value: StoredExperiencePattern
): Promise<ExperiencePattern> {
  const detail = await readDetail(value);
  return {
    uuid: value.uuid,
    type: value.type as ExperiencePatternType,
    agentUUID: value.agent_uuid || null,
    agentName: value.agent_name || null,
    workflowUUID: value.workflow_uuid || null,
    workflowName: value.workflow_name || null,
    issueTypeUUID: value.issue_type_uuid || null,
    businessTags: detail.businessTags,
    title: detail.title,
    repairStrategy: detail.repairStrategy,
    evidenceCount: value.evidence_count,
    successCount: value.success_count,
    confidence: value.confidence,
    allowedForPromptRecommendation: value.prompt_enabled,
    allowedForCandidateGeneration: value.candidate_enabled,
    allowedForRuntime: false,
    firstSeenAt: new Date(value.first_seen_at).toISOString(),
    lastSeenAt: new Date(value.last_seen_at).toISOString(),
    expiresAt:
      value.expires_at > 0 ? new Date(value.expires_at).toISOString() : null
  };
}

export async function upsertExperiencePattern(input: {
  teamUUID: string;
  patternKey: string;
  type: ExperiencePatternType;
  agentUUID?: string | null;
  agentName?: string | null;
  workflowUUID?: string | null;
  workflowName?: string | null;
  issueTypeUUID?: string | null;
  businessTags?: string[];
  title: string;
  repairStrategy: string;
  success: boolean;
}): Promise<ExperiencePattern> {
  const matches = await store.queryByIndexEqualTo(
    PATTERN_INDEX,
    'pattern_key',
    input.patternKey
  );
  const current = matches.find(
    (entry) => entry.value.team_uuid === input.teamUUID
  )?.value;
  const now = Date.now();
  const uuid = current?.uuid ?? randomUUID();
  const currentDetail = current ? await readDetail(current) : null;
  const evidenceCount = (current?.evidence_count ?? 0) + 1;
  const successCount = (current?.success_count ?? 0) + (input.success ? 1 : 0);
  const detail: ExperiencePatternDetail = {
    businessTags: Array.from(
      new Set(input.businessTags ?? currentDetail?.businessTags ?? [])
    )
      .map((tag) => tag.trim())
      .filter(Boolean),
    title: input.title.replace(/\s+/gu, ' ').trim().slice(0, 512),
    repairStrategy: input.repairStrategy.trim().slice(0, 2048)
  };
  const value: StoredExperiencePattern = {
    team_uuid: input.teamUUID,
    uuid,
    pattern_key: input.patternKey,
    type: input.type,
    agent_uuid: input.agentUUID ?? current?.agent_uuid ?? '',
    agent_name: input.agentName ?? current?.agent_name ?? '',
    workflow_uuid: input.workflowUUID ?? current?.workflow_uuid ?? '',
    workflow_name: input.workflowName ?? current?.workflow_name ?? '',
    issue_type_uuid: input.issueTypeUUID ?? current?.issue_type_uuid ?? '',
    detail_object_key:
      current?.detail_object_key ?? detailObjectKey(input.teamUUID, uuid),
    evidence_count: evidenceCount,
    success_count: successCount,
    confidence: Math.min(1, (successCount + 1) / (evidenceCount + 2)),
    prompt_enabled: true,
    candidate_enabled: true,
    runtime_enabled: false,
    first_seen_at: current?.first_seen_at ?? now,
    last_seen_at: now,
    expires_at: now + 90 * 24 * 60 * 60 * 1000
  };
  await Promise.all([
    store.set(key(value.uuid), value),
    uploadObjectJson(value.detail_object_key, detail)
  ]);
  return toPattern(value);
}

export async function listExperiencePatterns(input: {
  teamUUID: string;
  agentUUID?: string | null;
  workflowUUID?: string | null;
  includeExpired?: boolean;
}): Promise<ExperiencePattern[]> {
  const now = Date.now();
  const records = (
    await store.queryByIndexEqualTo(TEAM_INDEX, 'team_uuid', input.teamUUID)
  )
    .map((entry) => entry.value)
    .filter(
      (value) =>
        (!input.agentUUID || value.agent_uuid === input.agentUUID) &&
        (!input.workflowUUID || value.workflow_uuid === input.workflowUUID) &&
        (input.includeExpired ||
          value.expires_at === 0 ||
          value.expires_at > now)
    )
    .sort(
      (left, right) =>
        right.evidence_count - left.evidence_count ||
        right.last_seen_at - left.last_seen_at
    );
  return Promise.all(records.map(toPattern));
}
