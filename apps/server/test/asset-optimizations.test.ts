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
import { resolveAssetOptimizationRunCompatibilityFields } from '../src/modules/asset-optimizations/repository.js';

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

test('asset optimization run writes required historical manifest fields', () => {
  assert.deepEqual(resolveAssetOptimizationRunCompatibilityFields(), {
    failure_count: 0,
    blocked_count: 0
  });
  assert.deepEqual(
    resolveAssetOptimizationRunCompatibilityFields({
      failure_count: 3,
      blocked_count: 2
    }),
    {
      failure_count: 3,
      blocked_count: 2
    }
  );
});
