import type {
  AssetCandidateType,
  AssetEffectSnapshot,
  AssetOptimizationMetrics,
  AssetRelease
} from '@ones-ai-workflow/shared';
import {
  findIssueExecutionHistoryByUUID,
  listAgentVersionExecutionSamples,
  listAgentVersionExecutionSamplesInWindow,
  type IssueAgentExecutionHistoryRecord
} from '../executions/repository.js';
import {
  createAssetRelease,
  findAssetReleaseByCandidate,
  listAssetReleasesByAgent,
  readAssetReleaseBaseline,
  toAssetRelease,
  updateAssetRelease,
  type AssetOutcomeRates,
  type AssetReleaseBaseline
} from './repository.js';

const MIN_EFFECT_SAMPLES = 5;
const EFFECT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export class AssetEffectNotFoundError extends Error {
  constructor() {
    super('Asset release was not found');
    this.name = 'AssetEffectNotFoundError';
  }
}

export async function recordAssetCandidateRelease(input: {
  teamUUID: string;
  candidateUUID: string;
  agentUUID: string;
  assetType: AssetCandidateType;
  assetUUID: string | null;
  baseVersion: number;
  publishedVersion: number | null;
  baseline: AssetOptimizationMetrics;
  userUUID: string;
}): Promise<AssetRelease> {
  const status: AssetRelease['status'] =
    input.assetType === 'prompt'
      ? 'awaiting_publication'
      : input.assetType === 'knowledge'
        ? 'reviewed'
        : 'observing';
  const baselineSamples = await listAgentVersionExecutionSamples(
    input.agentUUID,
    input.baseVersion,
    input.teamUUID,
    20
  );
  const baseline: AssetReleaseBaseline = {
    metrics: buildMetricsFromRecords(
      baselineSamples,
      input.baseline.replaySampleCount
    ),
    outcomes: await calculateAssetOutcomeRates(baselineSamples, input.teamUUID)
  };
  return toAssetRelease(
    await createAssetRelease({
      ...input,
      baseline,
      status,
      publishedBy: input.userUUID
    })
  );
}

export async function finalizePendingAgentReleases(input: {
  teamUUID: string;
  agentUUID: string;
  publishedVersion: number;
  userUUID: string;
}): Promise<void> {
  const releases = await listAssetReleasesByAgent(
    input.agentUUID,
    input.teamUUID
  );
  await Promise.all(
    releases
      .filter((release) => release.status === 'awaiting_publication')
      .map((release) =>
        updateAssetRelease(release, {
          status: 'observing',
          publishedVersion: input.publishedVersion,
          publishedBy: input.userUUID,
          publishedAt: new Date()
        })
      )
  );
}

export async function refreshAgentAssetEffects(
  agentUUID: string,
  teamUUID: string
): Promise<void> {
  const releases = await listAssetReleasesByAgent(agentUUID, teamUUID);
  await Promise.all(
    releases
      .filter((release) => release.status === 'observing')
      .map((release) =>
        getCandidateAssetEffect(release.candidateUUID, teamUUID).then(
          () => undefined
        )
      )
  );
}

export async function getCandidateAssetEffect(
  candidateUUID: string,
  teamUUID: string
): Promise<AssetRelease> {
  let release = await findAssetReleaseByCandidate(candidateUUID, teamUUID);
  if (!release) throw new AssetEffectNotFoundError();
  if (release.status === 'observing') {
    const baseline = await readAssetReleaseBaseline(release);
    const measuredVersion =
      release.assetType === 'prompt'
        ? release.publishedVersion
        : release.baseVersion;
    if (measuredVersion !== null) {
      const publishedAt = release.publishedAt ?? release.createdAt;
      const samples = await listAgentVersionExecutionSamplesInWindow(
        release.agentUUID,
        measuredVersion,
        teamUUID,
        publishedAt,
        new Date(
          Math.min(Date.now(), publishedAt.getTime() + EFFECT_WINDOW_MS)
        ),
        20
      );
      const effect = buildAssetEffectSnapshot(
        release.uuid,
        baseline,
        buildMetricsFromRecords(samples, 0),
        await calculateAssetOutcomeRates(samples, teamUUID)
      );
      const observationComplete =
        samples.length >= 20 ||
        Date.now() >= publishedAt.getTime() + EFFECT_WINDOW_MS;
      const rollback =
        observationComplete && effect.verdict === 'negative'
          ? buildRollbackProposal(
              release,
              'system',
              '发布后效果被判定为负向影响'
            )
          : undefined;
      release = await updateAssetRelease(release, {
        effect,
        ...(rollback ? { rollback } : {}),
        ...(observationComplete ? { status: 'reviewed' as const } : {})
      });
    }
  }
  return toAssetRelease(release);
}

export async function createCandidateRollbackDraft(input: {
  candidateUUID: string;
  teamUUID: string;
  userUUID: string;
}): Promise<AssetRelease> {
  const release = await findAssetReleaseByCandidate(
    input.candidateUUID,
    input.teamUUID
  );
  if (!release) throw new AssetEffectNotFoundError();
  const effect = (await toAssetRelease(release)).effect;
  const rollback = buildRollbackProposal(
    release,
    input.userUUID,
    effect?.verdict === 'negative'
      ? '发布后效果被判定为负向影响'
      : '管理员手动创建回滚建议'
  );
  return toAssetRelease(
    await updateAssetRelease(release, {
      rollback
    })
  );
}

function buildRollbackProposal(
  release: {
    candidateUUID: string;
    assetType: AssetCandidateType;
    assetUUID: string | null;
    baseVersion: number;
    publishedVersion: number | null;
  },
  createdBy: string,
  reason: string
) {
  return {
    kind: 'asset_rollback_proposal',
    candidateUUID: release.candidateUUID,
    assetType: release.assetType,
    assetUUID: release.assetUUID,
    restoreVersion: release.baseVersion,
    currentVersion: release.publishedVersion,
    reason,
    createdBy,
    createdAt: new Date().toISOString(),
    automaticWritePerformed: false
  };
}

export function buildAssetEffectSnapshot(
  releaseUUID: string,
  baseline: AssetReleaseBaseline,
  current: {
    totalSamples: number;
    successCount: number;
    blockedCount: number;
    averageAttempts: number;
    totalTokens: number | null;
  },
  currentOutcomes: AssetOutcomeRates
): AssetEffectSnapshot {
  const beforeTotal = Math.max(1, baseline.metrics.totalSamples);
  const afterTotal = Math.max(1, current.totalSamples);
  const successRateBefore = baseline.metrics.successCount / beforeTotal;
  const successRateAfter = current.successCount / afterTotal;
  const blockedRateBefore = baseline.metrics.blockedCount / beforeTotal;
  const blockedRateAfter = current.blockedCount / afterTotal;
  let verdict: AssetEffectSnapshot['verdict'] = 'no_change';
  if (current.totalSamples < MIN_EFFECT_SAMPLES) {
    verdict = 'insufficient_samples';
  } else if (
    successRateAfter - successRateBefore >= 0.05 &&
    current.averageAttempts <= baseline.metrics.averageAttempts + 0.1
  ) {
    verdict = 'effective';
  } else if (
    successRateAfter - successRateBefore <= -0.05 ||
    blockedRateAfter - blockedRateBefore >= 0.05
  ) {
    verdict = 'negative';
  }
  return {
    releaseUUID,
    sampleCount: current.totalSamples,
    successRateBefore,
    successRateAfter,
    averageAttemptsBefore: baseline.metrics.averageAttempts,
    averageAttemptsAfter: current.averageAttempts,
    blockedRateBefore,
    blockedRateAfter,
    totalTokensBefore: baseline.metrics.totalTokens,
    totalTokensAfter: current.totalTokens,
    revisionRateBefore: baseline.outcomes.revisionRate,
    revisionRateAfter: currentOutcomes.revisionRate,
    knowledgeHitRateBefore: baseline.outcomes.knowledgeHitRate,
    knowledgeHitRateAfter: currentOutcomes.knowledgeHitRate,
    wikiWriteSuccessRateBefore: baseline.outcomes.wikiWriteSuccessRate,
    wikiWriteSuccessRateAfter: currentOutcomes.wikiWriteSuccessRate,
    acceptancePassRateBefore: baseline.outcomes.acceptancePassRate,
    acceptancePassRateAfter: currentOutcomes.acceptancePassRate,
    verdict,
    measuredAt: new Date().toISOString()
  };
}

export async function calculateAssetOutcomeRates(
  records: IssueAgentExecutionHistoryRecord[],
  teamUUID: string
): Promise<AssetOutcomeRates> {
  let revisionCount = 0;
  let revisionSampleCount = 0;
  let knowledgeHitCount = 0;
  let knowledgeSampleCount = 0;
  let wikiWriteCount = 0;
  let wikiWriteSuccessCount = 0;
  let acceptanceCount = 0;
  let acceptancePassCount = 0;

  for (const record of records) {
    const issueExecution = await findIssueExecutionHistoryByUUID(
      record.issueExecutionUUID,
      teamUUID
    );
    if (issueExecution) {
      revisionSampleCount += 1;
      if (issueExecution.triggerReason === 'revision') revisionCount += 1;
    }

    const executeOption = asRecord(record.executeOption);
    const wikiContext = asRecord(executeOption?.wikiContext);
    if (wikiContext && Array.isArray(wikiContext.knowledgeSources)) {
      knowledgeSampleCount += 1;
      if (wikiContext.knowledgeSources.length > 0) knowledgeHitCount += 1;
    }

    if (record.rawExecuteResult.includes('<wiki-action>')) {
      wikiWriteCount += 1;
      if (record.status === 'success') wikiWriteSuccessCount += 1;
    }

    const executeResult = asRecord(record.executeResult);
    const loopEvaluation = asRecord(executeResult?.loopEvaluation);
    if (typeof loopEvaluation?.decision === 'string') {
      acceptanceCount += 1;
      if (loopEvaluation.decision === 'pass') acceptancePassCount += 1;
    }
  }

  return {
    revisionRate: toRate(revisionCount, revisionSampleCount),
    knowledgeHitRate: toRate(knowledgeHitCount, knowledgeSampleCount),
    wikiWriteSuccessRate: toRate(wikiWriteSuccessCount, wikiWriteCount),
    acceptancePassRate: toRate(acceptancePassCount, acceptanceCount)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function buildMetricsFromRecords(
  records: IssueAgentExecutionHistoryRecord[],
  replaySampleCount: number
): AssetOptimizationMetrics {
  const attemptsByExecution = new Map<string, number>();
  for (const record of records) {
    attemptsByExecution.set(
      record.issueExecutionUUID,
      (attemptsByExecution.get(record.issueExecutionUUID) ?? 0) + 1
    );
  }
  const retryCount = Array.from(attemptsByExecution.values()).reduce(
    (total, count) => total + Math.max(0, count - 1),
    0
  );
  const successCount = records.filter(
    (record) => record.status === 'success'
  ).length;
  const failureCount = records.filter(
    (record) => record.status === 'failure'
  ).length;
  const blockedCount = records.filter(
    (record) => record.status === 'blocked'
  ).length;
  const tokensKnown =
    records.length > 0 &&
    records.every(
      (record) =>
        record.usageInputTokens !== null && record.usageOutputTokens !== null
    );
  return {
    totalSamples: records.length,
    successCount,
    failureCount,
    blockedCount,
    problemCount: failureCount + blockedCount + retryCount,
    retryCount,
    averageAttempts:
      attemptsByExecution.size > 0
        ? records.length / attemptsByExecution.size
        : 0,
    totalTokens: tokensKnown
      ? records.reduce(
          (total, record) =>
            total +
            Number(record.usageInputTokens) +
            Number(record.usageOutputTokens),
          0
        )
      : null,
    replaySampleCount
  };
}
