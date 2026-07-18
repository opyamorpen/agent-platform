import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dismissAssetCandidateSchema,
  mutateAssetCandidateSchema
} from '../src/modules/asset-optimizations/dto.js';
import {
  buildAutomaticTriggerSignature,
  resolveSkillCandidateBaseRevision,
  selectReplaySamples,
  shouldCreateAutomaticAssetOptimization
} from '../src/modules/asset-optimizations/service.js';
import { buildAssetEffectSnapshot } from '../src/modules/asset-effects/service.js';
import { getShadowReplayUnsupportedReason } from '../src/modules/asset-optimizations/shadow-replay-service.js';

test('asset optimization automatic thresholds trigger at 20 successes or 5 problems', () => {
  assert.equal(shouldCreateAutomaticAssetOptimization(19, 4), false);
  assert.equal(shouldCreateAutomaticAssetOptimization(20, 0), true);
  assert.equal(shouldCreateAutomaticAssetOptimization(0, 5), true);
});

test('automatic trigger signature changes only when a threshold bucket changes', () => {
  const first = buildAutomaticTriggerSignature('agent-a', 3, 20, 5);
  assert.equal(first, buildAutomaticTriggerSignature('agent-a', 3, 39, 9));
  assert.notEqual(first, buildAutomaticTriggerSignature('agent-a', 3, 40, 9));
});

test('new Skill candidates use the Agent version as the conflict revision', () => {
  assert.equal(resolveSkillCandidateBaseRevision(null, 7), 7);
  assert.equal(resolveSkillCandidateBaseRevision(3, 7), 3);
});

test('no-write replay samples prioritize problem executions and cap the list', () => {
  const samples = [
    { id: 'success-a', status: 'success' },
    { id: 'blocked-a', status: 'blocked' },
    { id: 'success-b', status: 'success' },
    { id: 'failure-a', status: 'failure' },
    { id: 'blocked-b', status: 'blocked' },
    { id: 'success-c', status: 'success' }
  ];
  const selected = selectReplaySamples(samples);
  assert.deepEqual(
    selected.map((sample) => sample.id),
    ['blocked-a', 'failure-a', 'blocked-b', 'success-a', 'success-b']
  );
});

test('candidate mutation DTOs parse optimistic revision timestamps', () => {
  const apply = mutateAssetCandidateSchema.parse({
    expectedUpdatedAt: '2026-07-18T00:00:00.000Z'
  });
  const dismiss = dismissAssetCandidateSchema.parse({
    expectedUpdatedAt: '2026-07-18T00:00:00.000Z'
  });
  assert.equal(apply.scriptReviewed, false);
  assert.equal(
    apply.expectedUpdatedAt.toISOString(),
    '2026-07-18T00:00:00.000Z'
  );
  assert.equal(
    dismiss.expectedUpdatedAt.toISOString(),
    '2026-07-18T00:00:00.000Z'
  );
});

test('asset effects require real samples and detect negative outcomes', () => {
  const baseline = {
    metrics: {
      totalSamples: 20,
      successCount: 18,
      failureCount: 1,
      blockedCount: 1,
      problemCount: 2,
      retryCount: 1,
      averageAttempts: 1.1,
      totalTokens: 10_000,
      replaySampleCount: 5
    },
    outcomes: {
      revisionRate: 0.2,
      knowledgeHitRate: 0.8,
      wikiWriteSuccessRate: 0.9,
      acceptancePassRate: 0.85
    }
  };
  assert.equal(
    buildAssetEffectSnapshot(
      'release-1',
      baseline,
      {
        totalSamples: 4,
        successCount: 4,
        blockedCount: 0,
        averageAttempts: 1,
        totalTokens: 2_000
      },
      {
        revisionRate: 0,
        knowledgeHitRate: 1,
        wikiWriteSuccessRate: 1,
        acceptancePassRate: 1
      }
    ).verdict,
    'insufficient_samples'
  );
  assert.equal(
    buildAssetEffectSnapshot(
      'release-1',
      baseline,
      {
        totalSamples: 10,
        successCount: 6,
        blockedCount: 2,
        averageAttempts: 1.5,
        totalTokens: 8_000
      },
      {
        revisionRate: 0.4,
        knowledgeHitRate: 0.5,
        wikiWriteSuccessRate: 0.6,
        acceptancePassRate: 0.5
      }
    ).verdict,
    'negative'
  );
});

test('shadow replay rejects code workspaces and Agent Client execution', () => {
  const baseConfig = {
    description: '',
    prompt: '',
    inputs: [],
    outputs: [],
    knowledgeSourceUUIDs: [],
    acceptancePolicy: {
      criteria: [],
      knowledgeRequirement: 'optional' as const,
      verificationProfileUUIDs: []
    },
    executionTarget: { mode: 'organization_model' as const }
  };
  assert.match(
    getShadowReplayUnsupportedReason('workspace-1', baseConfig, {
      type: 'prompt',
      prompt: 'test'
    }) ?? '',
    /Code workspace/u
  );
  assert.match(
    getShadowReplayUnsupportedReason(
      null,
      {
        ...baseConfig,
        executionTarget: {
          mode: 'agent_client' as const,
          clientUUID: null,
          clientName: null
        }
      },
      { type: 'prompt', prompt: 'test' }
    ) ?? '',
    /Agent Client/u
  );
});
