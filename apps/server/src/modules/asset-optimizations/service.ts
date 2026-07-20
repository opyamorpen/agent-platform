import { createHash, randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  AssetCandidate,
  AssetCandidateContent,
  AssetCandidateSummary,
  AssetOptimizationMetrics,
  AssetOptimizationRun,
  AssetOptimizationRunSummary,
  AssetOptimizationTrigger
} from '@ones-ai-workflow/shared';
import { getLogger } from '../../lib/logger.js';
import {
  addAgentSkillBinding,
  findAgentByUUID,
  findAgentVersion,
  listAgents,
  updateAgentDraftConfig
} from '../agents/repository.js';
import { getAIModelConfigStatus } from '../ai-model-config/service.js';
import {
  getAgentVersionExecutionAggregate,
  listAgentVersionExecutionSamples,
  type IssueAgentExecutionHistoryRecord
} from '../executions/repository.js';
import { findKnowledgeSourcesByUUIDs } from '../knowledge-sources/repository.js';
import { isLoopRuntimeEnabled } from '../loop-runtime-config/service.js';
import { validateGeneratedSkillFiles } from '../skill-generation/validation.js';
import {
  createSkillRecord,
  readCurrentSkillMarkdown,
  removeSkillRecord,
  uploadSkillVersionRecord
} from '../skills/service.js';
import { findSkillByName, findSkillByUUID } from '../skills/repository.js';
import { listWorkflowTeamUUIDs } from '../workflows/repository.js';
import { generateAssetCandidates, replayAssetCandidates } from './model.js';
import {
  createAssetCandidate,
  createAssetOptimizationRun,
  findAssetCandidate,
  findAssetOptimizationRun,
  findAssetOptimizationRunBySignature,
  listAssetCandidatesByRun,
  listAssetOptimizationRuns,
  readAssetCandidateContent,
  readAssetOptimizationReplay,
  updateAssetCandidate,
  updateAssetOptimizationRun,
  writeAssetOptimizationReplay,
  writeAssetOptimizationSamples,
  AssetCandidateRevisionConflictError,
  type AssetCandidateRecord,
  type AssetOptimizationRunRecord
} from './repository.js';

const MAX_STORED_SAMPLES = 20;
const MAX_GENERATION_SAMPLES = 12;
const MAX_REPLAY_SAMPLES = 5;
const AUTO_SUCCESS_THRESHOLD = 20;
const AUTO_PROBLEM_THRESHOLD = 5;
const AUTO_SCAN_INTERVAL_MS = 5 * 60 * 1000;
const STALE_GENERATION_MS = 15 * 60 * 1000;
const STALE_APPLY_MS = 15 * 60 * 1000;
const logger = getLogger('asset-optimizations');
const activeRunUUIDs = new Set<string>();
let automaticScanRunning = false;
let automaticScanTimer: NodeJS.Timeout | null = null;

function deterministicUUID(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export class AssetOptimizationNotFoundError extends Error {
  constructor(message = 'Asset optimization record was not found') {
    super(message);
    this.name = 'AssetOptimizationNotFoundError';
  }
}

export class AssetOptimizationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetOptimizationConflictError';
  }
}

export class AssetOptimizationNoSamplesError extends Error {
  constructor() {
    super('The selected Agent version has no completed execution samples');
    this.name = 'AssetOptimizationNoSamplesError';
  }
}

export class AssetOptimizationScriptReviewRequiredError extends Error {
  constructor() {
    super('Generated Skill scripts must be reviewed before publication');
    this.name = 'AssetOptimizationScriptReviewRequiredError';
  }
}

export function startAssetOptimizationScheduler(): void {
  if (automaticScanTimer) return;
  automaticScanTimer = setInterval(() => {
    void runAutomaticAssetOptimizationScan();
  }, AUTO_SCAN_INTERVAL_MS);
  setTimeout(() => {
    void runAutomaticAssetOptimizationScan();
  }, 60_000);
}

export async function listAssetOptimizationRunSummaries(
  teamUUID: string
): Promise<AssetOptimizationRunSummary[]> {
  const runs = await listAssetOptimizationRuns(teamUUID);
  return Promise.all(runs.map(toRunSummary));
}

export async function getAssetOptimizationRun(
  uuid: string,
  teamUUID: string
): Promise<AssetOptimizationRun> {
  const run = await findAssetOptimizationRun(uuid, teamUUID);
  if (!run) throw new AssetOptimizationNotFoundError();
  const [records, replay] = await Promise.all([
    listAssetCandidatesByRun(run.uuid, teamUUID),
    readReplaySafely(run)
  ]);
  const candidates = await Promise.all(
    records.map(async (record) =>
      toCandidate(
        record,
        await readAssetCandidateContent(record),
        replay[record.uuid] ?? null
      )
    )
  );
  return {
    ...(await toRunSummary(run)),
    candidates
  };
}

export async function createManualAssetOptimization(input: {
  agentUUID: string;
  teamUUID: string;
  userUUID: string;
}): Promise<AssetOptimizationRunSummary> {
  const agent = await findAgentByUUID(input.agentUUID, input.teamUUID);
  if (!agent || agent.currentVersion === null) {
    throw new AssetOptimizationNotFoundError('Published Agent was not found');
  }
  const [modelStatus, aggregate] = await Promise.all([
    getAIModelConfigStatus(input.teamUUID),
    getAgentVersionExecutionAggregate(
      agent.uuid,
      agent.currentVersion,
      input.teamUUID
    )
  ]);
  if (!modelStatus.configured) {
    throw new AssetOptimizationConflictError(
      'The organization AI model is not configured'
    );
  }
  if (aggregate.totalSamples === 0) throw new AssetOptimizationNoSamplesError();

  const run = await createAssetOptimizationRun({
    teamUUID: input.teamUUID,
    uuid: randomUUID(),
    agentUUID: agent.uuid,
    agentName: agent.name,
    agentVersion: agent.currentVersion,
    trigger: 'manual',
    triggerSignature: `manual:${randomUUID()}`,
    createdBy: input.userUUID
  });
  launchRun(run);
  return toRunSummary(run);
}

export async function applyAssetCandidate(input: {
  uuid: string;
  teamUUID: string;
  userUUID: string;
  expectedUpdatedAt: Date;
  scriptReviewed: boolean;
}): Promise<AssetCandidate> {
  const candidate = await findAssetCandidate(input.uuid, input.teamUUID);
  if (!candidate)
    throw new AssetOptimizationNotFoundError('Candidate was not found');
  if (['applied', 'reviewed'].includes(candidate.status)) {
    return getCandidateWithReplay(candidate);
  }
  if (candidate.status === 'applying') {
    throw new AssetOptimizationConflictError(
      'The candidate is already being applied by another request'
    );
  }
  if (candidate.status === 'dismissed') {
    throw new AssetOptimizationConflictError(
      'Dismissed candidates cannot be applied'
    );
  }
  if (candidate.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    throw new AssetOptimizationConflictError(
      'The candidate changed in another page. Refresh and try again.'
    );
  }

  const run = await findAssetOptimizationRun(candidate.runUUID, input.teamUUID);
  if (!run) throw new AssetOptimizationNotFoundError();
  if (!['ready', 'completed'].includes(run.status)) {
    throw new AssetOptimizationConflictError(
      'Candidates can only be applied after replay assessment is ready'
    );
  }
  if (candidate.hasScripts && !input.scriptReviewed) {
    throw new AssetOptimizationScriptReviewRequiredError();
  }

  let claimed: AssetCandidateRecord;
  try {
    claimed = await updateAssetCandidate(
      candidate,
      {
        status: 'applying',
        conflictReason: null,
        appliedBy: input.userUUID
      },
      input.expectedUpdatedAt
    );
  } catch (error) {
    if (error instanceof AssetCandidateRevisionConflictError) {
      throw new AssetOptimizationConflictError(
        'The candidate changed in another request. Refresh and try again.'
      );
    }
    throw error;
  }
  let updated: AssetCandidateRecord;
  try {
    const content = await readAssetCandidateContent(claimed);
    let appliedAssetUUID: string | null = null;
    let status: 'applied' | 'reviewed' = 'applied';
    if (content.type === 'prompt') {
      appliedAssetUUID = await applyPromptCandidate(run, claimed, content);
    } else if (content.type === 'skill') {
      appliedAssetUUID = await applySkillCandidate(
        run,
        claimed,
        content,
        input.scriptReviewed
      );
    } else {
      await assertAgentVersionUnchanged(run, claimed);
      status = 'reviewed';
    }
    updated = await updateAssetCandidate(
      claimed,
      {
        status,
        conflictReason: null,
        appliedAssetUUID,
        appliedBy: input.userUUID
      },
      claimed.updatedAt
    );
  } catch (error) {
    const conflict =
      error instanceof AssetCandidateRevisionConflictError
        ? new AssetOptimizationConflictError(
            'The candidate changed in another request. Refresh and try again.'
          )
        : error;
    if (
      conflict instanceof AssetOptimizationConflictError ||
      conflict instanceof AssetOptimizationScriptReviewRequiredError
    ) {
      if (conflict instanceof AssetOptimizationConflictError) {
        await updateAssetCandidate(claimed, {
          status: 'conflict',
          conflictReason: conflict.message
        }).catch(() => undefined);
      }
      throw conflict;
    }
    await updateAssetCandidate(claimed, {
      status: 'conflict',
      conflictReason: truncate(
        error instanceof Error ? error.message : String(error),
        512
      )
    }).catch(() => undefined);
    throw error;
  }
  await refreshRunCompletion(run).catch((error) => {
    logger.warn(
      '[asset-optimization] candidate applied but run status failed',
      {
        runUUID: run.uuid,
        candidateUUID: updated.uuid,
        error: error instanceof Error ? error.message : String(error)
      }
    );
  });
  return getCandidateWithReplay(updated);
}

export async function dismissAssetCandidate(input: {
  uuid: string;
  teamUUID: string;
  userUUID: string;
  expectedUpdatedAt: Date;
}): Promise<AssetCandidate> {
  const candidate = await findAssetCandidate(input.uuid, input.teamUUID);
  if (!candidate)
    throw new AssetOptimizationNotFoundError('Candidate was not found');
  if (['applied', 'reviewed'].includes(candidate.status)) {
    throw new AssetOptimizationConflictError(
      'Applied or reviewed candidates cannot be dismissed'
    );
  }
  if (candidate.status === 'applying') {
    throw new AssetOptimizationConflictError(
      'Candidates being applied cannot be dismissed'
    );
  }
  let updated: AssetCandidateRecord;
  try {
    updated = await updateAssetCandidate(
      candidate,
      {
        status: 'dismissed',
        conflictReason: null,
        appliedBy: input.userUUID
      },
      input.expectedUpdatedAt
    );
  } catch (error) {
    if (error instanceof AssetCandidateRevisionConflictError) {
      throw new AssetOptimizationConflictError(
        'The candidate changed in another request. Refresh and try again.'
      );
    }
    throw error;
  }
  const run = await findAssetOptimizationRun(candidate.runUUID, input.teamUUID);
  if (run) await refreshRunCompletion(run);
  return getCandidateWithReplay(updated);
}

export async function runAutomaticAssetOptimizationScan(): Promise<void> {
  if (automaticScanRunning) return;
  automaticScanRunning = true;
  try {
    const teamUUIDs = await listWorkflowTeamUUIDs();
    for (const teamUUID of teamUUIDs) {
      await markStaleRunsFailed(teamUUID);
      await markStaleCandidateApplications(teamUUID);
      if (!(await isLoopRuntimeEnabled(teamUUID))) continue;
      if (!(await getAIModelConfigStatus(teamUUID)).configured) continue;
      const agents = await listAgents(teamUUID);
      for (const summary of agents) {
        const agent = await findAgentByUUID(summary.uuid, teamUUID);
        if (!agent || agent.currentVersion === null) continue;
        const aggregate = await getAgentVersionExecutionAggregate(
          agent.uuid,
          agent.currentVersion,
          teamUUID
        );
        const problemCount =
          aggregate.failureCount +
          aggregate.blockedCount +
          aggregate.retryCount;
        if (
          !shouldCreateAutomaticAssetOptimization(
            aggregate.successCount,
            problemCount
          )
        ) {
          continue;
        }
        const signature = buildAutomaticTriggerSignature(
          agent.uuid,
          agent.currentVersion,
          aggregate.successCount,
          problemCount
        );
        if (await findAssetOptimizationRunBySignature(signature, teamUUID)) {
          continue;
        }
        const run = await createAssetOptimizationRun({
          teamUUID,
          uuid: deterministicUUID(`asset-run:${teamUUID}:${signature}`),
          agentUUID: agent.uuid,
          agentName: agent.name,
          agentVersion: agent.currentVersion,
          trigger: 'automatic',
          triggerSignature: signature,
          createdBy: 'system'
        });
        launchRun(run);
        return;
      }
    }
  } catch (error) {
    logger.error('[asset-optimization] automatic scan failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    automaticScanRunning = false;
  }
}

function launchRun(run: AssetOptimizationRunRecord): void {
  if (activeRunUUIDs.has(run.uuid)) return;
  activeRunUUIDs.add(run.uuid);
  void processRun(run)
    .catch((error) => {
      logger.error('[asset-optimization] run failed', {
        runUUID: run.uuid,
        error: error instanceof Error ? error.message : String(error)
      });
    })
    .finally(() => activeRunUUIDs.delete(run.uuid));
}

async function processRun(run: AssetOptimizationRunRecord): Promise<void> {
  try {
    const agent = await findAgentByUUID(run.agentUUID, run.teamUUID);
    if (!agent || agent.currentVersion !== run.agentVersion) {
      throw new AssetOptimizationConflictError(
        'The Agent published version changed before generation started'
      );
    }
    const version = await findAgentVersion(
      run.agentUUID,
      run.agentVersion,
      run.teamUUID
    );
    if (!version)
      throw new AssetOptimizationNotFoundError('Agent version was not found');
    const [aggregate, records, knowledgeSources] = await Promise.all([
      getAgentVersionExecutionAggregate(
        run.agentUUID,
        run.agentVersion,
        run.teamUUID
      ),
      listAgentVersionExecutionSamples(
        run.agentUUID,
        run.agentVersion,
        run.teamUUID,
        MAX_STORED_SAMPLES
      ),
      findKnowledgeSourcesByUUIDs(
        version.config.knowledgeSourceUUIDs,
        run.teamUUID
      )
    ]);
    if (records.length === 0) throw new AssetOptimizationNoSamplesError();
    const samples = records.map(toStoredSample);
    const metrics = buildMetrics(aggregate, samples);
    await writeAssetOptimizationSamples(run, samples);
    run = await updateAssetOptimizationRun(run, { metrics });

    const skills = await loadBoundSkills(agent.skillUUIDs, run.teamUUID);
    const generated = await generateAssetCandidates({
      teamUUID: run.teamUUID,
      agent: {
        uuid: run.agentUUID,
        name: run.agentName,
        version: run.agentVersion,
        config: compactAgentConfig(version.config)
      },
      skills,
      knowledgeSources: knowledgeSources.map((source) => ({
        uuid: source.uuid,
        name: source.name,
        description: source.description,
        spaceName: source.spaceName
      })),
      samples: samples.slice(0, MAX_GENERATION_SAMPLES)
    });

    const candidates: Array<{
      record: AssetCandidateRecord;
      content: AssetCandidateContent;
    }> = [];
    for (const generatedCandidate of generated.candidates) {
      const prepared = await prepareGeneratedCandidate(
        generatedCandidate.content,
        agent.skillUUIDs,
        run.teamUUID,
        run.agentVersion
      );
      const record = await createAssetCandidate({
        teamUUID: run.teamUUID,
        uuid: deterministicUUID(`asset-candidate:${run.uuid}:${generatedCandidate.type}`),
        runUUID: run.uuid,
        type: generatedCandidate.type,
        title: generatedCandidate.title,
        summary: generatedCandidate.summary,
        targetUUID: prepared.targetUUID,
        baseRevision: prepared.baseRevision,
        content: prepared.content,
        hasScripts: prepared.hasScripts,
        createdBy: run.createdBy
      });
      candidates.push({ record, content: prepared.content });
    }

    const replaySamples = selectReplaySamples(samples);
    const replay = await replayAssetCandidates({
      teamUUID: run.teamUUID,
      baseline: {
        actualSuccessRate:
          metrics.totalSamples > 0
            ? metrics.successCount / metrics.totalSamples
            : 0,
        averageAttempts: metrics.averageAttempts,
        totalTokens: metrics.totalTokens
      },
      samples: replaySamples,
      candidates: candidates.map(({ record, content }) => ({
        uuid: record.uuid,
        type: record.type,
        title: record.title,
        summary: record.summary,
        content
      }))
    });
    await writeAssetOptimizationReplay(run, replay);
    await updateAssetOptimizationRun(run, {
      status: 'ready',
      metrics: { ...metrics, replaySampleCount: replaySamples.length },
      completedAt: new Date(),
      errorMessage: null
    });
  } catch (error) {
    await updateAssetOptimizationRun(run, {
      status: 'failed',
      errorMessage: truncate(
        error instanceof Error ? error.message : String(error),
        512
      ),
      completedAt: new Date()
    }).catch(() => undefined);
    throw error;
  }
}

async function applyPromptCandidate(
  run: AssetOptimizationRunRecord,
  candidate: AssetCandidateRecord,
  content: Extract<AssetCandidateContent, { type: 'prompt' }>
): Promise<string> {
  const agent = await findAgentByUUID(run.agentUUID, run.teamUUID);
  if (!agent || agent.currentVersion !== candidate.baseRevision) {
    throw new AssetOptimizationConflictError(
      'The Agent published version changed after this candidate was generated'
    );
  }
  if (agent.draftConfig) {
    throw new AssetOptimizationConflictError(
      'The Agent already has an unpublished human draft'
    );
  }
  const published = await findAgentVersion(
    run.agentUUID,
    candidate.baseRevision,
    run.teamUUID
  );
  if (!published)
    throw new AssetOptimizationNotFoundError('Agent version was not found');
  await updateAgentDraftConfig(
    run.agentUUID,
    { ...published.config, prompt: content.prompt },
    run.teamUUID
  );
  return run.agentUUID;
}

async function applySkillCandidate(
  run: AssetOptimizationRunRecord,
  candidate: AssetCandidateRecord,
  content: Extract<AssetCandidateContent, { type: 'skill' }>,
  scriptReviewed: boolean
): Promise<string> {
  const validated = validateGeneratedSkillFiles(content.files);
  if (validated.hasScripts && !scriptReviewed) {
    throw new AssetOptimizationScriptReviewRequiredError();
  }
  const files = validated.files.map((file) => ({
    relativePath: file.path,
    file: new File([file.content], file.path, {
      type: 'text/plain;charset=utf-8'
    })
  }));
  if (candidate.targetUUID) {
    const agent = await findAgentByUUID(run.agentUUID, run.teamUUID);
    if (!agent?.skillUUIDs.includes(candidate.targetUUID)) {
      throw new AssetOptimizationConflictError(
        'The target Skill is no longer bound to this Agent'
      );
    }
    const skill = await findSkillByUUID(candidate.targetUUID, run.teamUUID);
    if (!skill || skill.currentVersion !== candidate.baseRevision) {
      throw new AssetOptimizationConflictError(
        'The target Skill version changed after this candidate was generated'
      );
    }
    const updated = await uploadSkillVersionRecord(
      skill.uuid,
      { files },
      run.teamUUID
    );
    return updated.uuid;
  }
  const agent = await assertAgentVersionUnchanged(run, candidate);
  if (agent.draftConfig) {
    throw new AssetOptimizationConflictError(
      'The Agent already has an unpublished human draft'
    );
  }
  const existing = await findSkillByName(content.skillName, run.teamUUID);
  if (existing) {
    throw new AssetOptimizationConflictError(
      `A Skill named "${content.skillName}" already exists`
    );
  }
  const created = await createSkillRecord({ files }, run.teamUUID);
  try {
    await addAgentSkillBinding(run.agentUUID, created.uuid, run.teamUUID);
  } catch (error) {
    await removeSkillRecord(created.uuid, run.teamUUID).catch(() => undefined);
    throw error;
  }
  return created.uuid;
}

async function prepareGeneratedCandidate(
  content: AssetCandidateContent,
  boundSkillUUIDs: string[],
  teamUUID: string,
  agentVersion: number
): Promise<{
  content: AssetCandidateContent;
  targetUUID: string | null;
  baseRevision: number;
  hasScripts: boolean;
}> {
  if (content.type === 'prompt') {
    return {
      content,
      targetUUID: null,
      baseRevision: agentVersion,
      hasScripts: false
    };
  }
  if (content.type === 'knowledge') {
    return {
      content,
      targetUUID: null,
      baseRevision: agentVersion,
      hasScripts: false
    };
  }
  if (content.skillUUID && !boundSkillUUIDs.includes(content.skillUUID)) {
    throw new Error('Generated Skill candidate targets an unbound Skill');
  }
  const validated = validateGeneratedSkillFiles(content.files);
  const target = content.skillUUID
    ? await findSkillByUUID(content.skillUUID, teamUUID)
    : null;
  if (content.skillUUID && !target) {
    throw new Error('Generated Skill candidate target was not found');
  }
  return {
    content: { ...content, files: validated.files },
    targetUUID: target?.uuid ?? null,
    baseRevision: resolveSkillCandidateBaseRevision(
      target?.currentVersion ?? null,
      agentVersion
    ),
    hasScripts: validated.hasScripts
  };
}

async function assertAgentVersionUnchanged(
  run: AssetOptimizationRunRecord,
  candidate: AssetCandidateRecord
) {
  const agent = await findAgentByUUID(run.agentUUID, run.teamUUID);
  if (!agent || agent.currentVersion !== candidate.baseRevision) {
    throw new AssetOptimizationConflictError(
      'The Agent published version changed after this candidate was generated'
    );
  }
  return agent;
}

async function loadBoundSkills(skillUUIDs: string[], teamUUID: string) {
  const skills = [];
  let totalChars = 0;
  for (const uuid of skillUUIDs.slice(0, 20)) {
    const [record, document] = await Promise.all([
      findSkillByUUID(uuid, teamUUID),
      readCurrentSkillMarkdown(uuid, teamUUID)
    ]);
    if (!record) continue;
    const remaining = Math.max(0, 128 * 1024 - totalChars);
    if (remaining === 0) break;
    const content = document.content.slice(0, remaining);
    totalChars += content.length;
    skills.push({
      uuid: record.uuid,
      name: record.name,
      version: record.currentVersion,
      document: content
    });
  }
  return skills;
}

function compactAgentConfig(config: AgentConfig): AgentConfig {
  return {
    ...config,
    prompt: config.prompt.slice(0, 64 * 1024)
  };
}

function toStoredSample(record: IssueAgentExecutionHistoryRecord) {
  return {
    uuid: record.uuid,
    status: record.status,
    taskPromptExcerpt: record.prompt.slice(0, 3_000),
    executePayload: truncateJSON(record.executePayload, 6_000),
    candidateOutput: (
      record.rawExecuteResult || JSON.stringify(record.executeResult)
    ).slice(0, 8_000),
    evaluation: truncateJSON(
      isRecord(record.executeResult)
        ? (record.executeResult.loopEvaluation ?? record.executeResult)
        : record.executeResult,
      4_000
    ),
    logTail: record.logs.slice(-2_000),
    usage: {
      inputTokens: record.usageInputTokens,
      outputTokens: record.usageOutputTokens
    },
    createdAt: record.createdAt.toISOString()
  };
}

export function selectReplaySamples<T extends { status: string }>(
  samples: T[]
): T[] {
  const problems = samples.filter((sample) => sample.status !== 'success');
  const successes = samples.filter((sample) => sample.status === 'success');
  return [...problems, ...successes].slice(0, MAX_REPLAY_SAMPLES);
}

function buildMetrics(
  aggregate: Awaited<ReturnType<typeof getAgentVersionExecutionAggregate>>,
  samples: unknown[]
): AssetOptimizationMetrics {
  return {
    totalSamples: aggregate.totalSamples,
    successCount: aggregate.successCount,
    problemCount:
      aggregate.failureCount + aggregate.blockedCount + aggregate.retryCount,
    retryCount: aggregate.retryCount,
    averageAttempts: aggregate.averageAttempts,
    totalTokens: aggregate.totalTokens,
    replaySampleCount: Math.min(samples.length, MAX_REPLAY_SAMPLES)
  };
}

async function toRunSummary(
  run: AssetOptimizationRunRecord
): Promise<AssetOptimizationRunSummary> {
  const candidates = await listAssetCandidatesByRun(run.uuid, run.teamUUID);
  return {
    uuid: run.uuid,
    agent: { uuid: run.agentUUID, name: run.agentName },
    agentVersion: run.agentVersion,
    trigger: run.trigger,
    status: run.status,
    metrics: run.metrics,
    candidateCount: candidates.length,
    errorMessage: run.errorMessage,
    createdBy: run.createdBy,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null
  };
}

function toCandidateSummary(
  record: AssetCandidateRecord,
  replayScore: AssetCandidateSummary['replayScore']
): AssetCandidateSummary {
  return {
    uuid: record.uuid,
    runUUID: record.runUUID,
    type: record.type,
    status: record.status,
    title: record.title,
    summary: record.summary,
    targetUUID: record.targetUUID,
    baseRevision: record.baseRevision,
    hasScripts: record.hasScripts,
    replayScore,
    conflictReason: record.conflictReason,
    appliedAssetUUID: record.appliedAssetUUID,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toCandidate(
  record: AssetCandidateRecord,
  content: AssetCandidateContent,
  replayScore: AssetCandidateSummary['replayScore']
): AssetCandidate {
  return {
    ...toCandidateSummary(record, replayScore),
    content
  };
}

async function getCandidateWithReplay(
  record: AssetCandidateRecord
): Promise<AssetCandidate> {
  const run = await findAssetOptimizationRun(record.runUUID, record.teamUUID);
  const replay = run ? await readReplaySafely(run) : {};
  return toCandidate(
    record,
    await readAssetCandidateContent(record),
    replay[record.uuid] ?? null
  );
}

async function readReplaySafely(run: AssetOptimizationRunRecord) {
  try {
    return await readAssetOptimizationReplay(run);
  } catch {
    return {};
  }
}

async function refreshRunCompletion(run: AssetOptimizationRunRecord) {
  const candidates = await listAssetCandidatesByRun(run.uuid, run.teamUUID);
  const completed =
    candidates.length > 0 &&
    candidates.every((candidate) =>
      ['applied', 'reviewed', 'dismissed'].includes(candidate.status)
    );
  if (completed) {
    await updateAssetOptimizationRun(run, {
      status: 'completed',
      completedAt: new Date()
    });
  }
}

async function markStaleRunsFailed(teamUUID: string) {
  const runs = await listAssetOptimizationRuns(teamUUID);
  const stale = runs.filter(
    (run) =>
      run.status === 'generating' &&
      Date.now() - run.updatedAt.getTime() > STALE_GENERATION_MS &&
      !activeRunUUIDs.has(run.uuid)
  );
  await Promise.all(
    stale.map((run) =>
      updateAssetOptimizationRun(run, {
        status: 'failed',
        errorMessage: 'Generation was interrupted before completion',
        completedAt: new Date()
      })
    )
  );
}

async function markStaleCandidateApplications(teamUUID: string) {
  const runs = await listAssetOptimizationRuns(teamUUID);
  const candidates = (
    await Promise.all(
      runs.map((run) => listAssetCandidatesByRun(run.uuid, teamUUID))
    )
  ).flat();
  const stale = candidates.filter(
    (candidate) =>
      candidate.status === 'applying' &&
      Date.now() - candidate.updatedAt.getTime() > STALE_APPLY_MS
  );
  await Promise.all(
    stale.map((candidate) =>
      updateAssetCandidate(candidate, {
        status: 'conflict',
        conflictReason:
          'Publication was interrupted before the candidate status was saved'
      })
    )
  );
}

export function shouldCreateAutomaticAssetOptimization(
  successCount: number,
  problemCount: number
): boolean {
  return (
    successCount >= AUTO_SUCCESS_THRESHOLD ||
    problemCount >= AUTO_PROBLEM_THRESHOLD
  );
}

export function buildAutomaticTriggerSignature(
  agentUUID: string,
  version: number,
  successCount: number,
  problemCount: number
): string {
  return [
    agentUUID,
    `v${version}`,
    `s${Math.floor(successCount / AUTO_SUCCESS_THRESHOLD)}`,
    `p${Math.floor(problemCount / AUTO_PROBLEM_THRESHOLD)}`
  ].join(':');
}

export function resolveSkillCandidateBaseRevision(
  targetCurrentVersion: number | null,
  agentVersion: number
): number {
  return targetCurrentVersion ?? agentVersion;
}

function truncateJSON(value: unknown, maxLength: number): unknown {
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxLength) return value;
  return `${serialized.slice(0, maxLength)}...[truncated]`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
