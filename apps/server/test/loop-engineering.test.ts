import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AgentConfig,
  WorkflowNodeLoopPolicy
} from '@ones-ai-workflow/shared';
import {
  buildLoopContextXml,
  buildNextLoopAttemptUUID,
  calculateLoopBudget,
  decideLoopGate,
  isLoopEscalationCommentText,
  isLoopPolicyRuntimeEligible
} from '../src/modules/executions/loop-engineering.js';
import type { IssueAgentExecutionHistoryRecord } from '../src/modules/executions/repository.js';

const policy: WorkflowNodeLoopPolicy = {
  enabled: true,
  maxAttempts: 3,
  maxDurationMinutes: 30,
  maxTotalTokens: 100_000,
  escalationTargetStatus: { uuid: 'status-human', name: 'Human review' }
};

const config = {
  description: '',
  prompt: '',
  inputs: [],
  outputs: [],
  knowledgeSourceUUIDs: [],
  acceptancePolicy: {
    criteria: [
      {
        uuid: 'criterion-1',
        name: 'Complete',
        description: 'All fields are complete'
      }
    ],
    knowledgeRequirement: 'optional',
    verificationProfileUUIDs: []
  }
} satisfies AgentConfig;

function attempt(inputTokens: number | null, outputTokens: number | null) {
  return {
    usageInputTokens: inputTokens,
    usageOutputTokens: outputTokens
  } as IssueAgentExecutionHistoryRecord;
}

test('loop runtime requires all three gates', () => {
  assert.equal(
    isLoopPolicyRuntimeEligible({
      teamEnabled: true,
      policy,
      agentConfig: config
    }),
    true
  );
  assert.equal(
    isLoopPolicyRuntimeEligible({
      teamEnabled: false,
      policy,
      agentConfig: config
    }),
    false
  );
  assert.equal(
    isLoopPolicyRuntimeEligible({
      teamEnabled: true,
      policy: { ...policy, enabled: false },
      agentConfig: config
    }),
    false
  );
  assert.equal(
    isLoopPolicyRuntimeEligible({
      teamEnabled: true,
      policy,
      agentConfig: {
        ...config,
        acceptancePolicy: { ...config.acceptancePolicy, criteria: [] }
      }
    }),
    false
  );
});

test('loop budget enforces attempts and keeps token budget unavailable when usage is missing', () => {
  const budget = calculateLoopBudget({
    policy,
    executionCreatedAt: new Date('2026-07-18T00:00:00Z'),
    attempts: [attempt(100, 50), attempt(null, null), attempt(0, 0)],
    currentUsage: { inputTokens: null, outputTokens: null },
    now: new Date('2026-07-18T00:10:00Z')
  });

  assert.equal(budget.attemptNumber, 3);
  assert.equal(budget.totalTokens, null);
  assert.deepEqual(budget.exhaustedBy, ['attempts']);
});

test('loop retry UUID and context are stable and carry correction evidence', () => {
  const first = buildNextLoopAttemptUUID('task-1');
  assert.equal(buildNextLoopAttemptUUID('task-1'), first);
  assert.match(first, /^[0-9a-f-]{36}$/u);

  const xml = buildLoopContextXml({
    loopContext: {
      attemptNumber: 2,
      previousAttemptUUID: 'task-1',
      previousCandidate: '<outputs />',
      deterministicValidation: {
        passed: false,
        errors: ['field uuid invalid']
      },
      aiReview: { verdict: 'revise' }
    }
  });
  assert.match(xml, /<mode>revision<\/mode>/u);
  assert.match(xml, /field uuid invalid/u);
});

test('loop escalation comments are lifecycle comments', () => {
  assert.equal(
    isLoopEscalationCommentText('[AI循环升级][Agent][第3次尝试]'),
    true
  );
  assert.equal(isLoopEscalationCommentText('人工审核意见'), false);
});

test('loop gate never bypasses missing review and escalates exhausted revisions', () => {
  assert.equal(
    decideLoopGate({
      deterministicPassed: true,
      forceEscalation: false,
      reviewVerdict: null,
      budgetExhausted: false
    }),
    'escalate'
  );
  assert.equal(
    decideLoopGate({
      deterministicPassed: false,
      forceEscalation: false,
      reviewVerdict: null,
      budgetExhausted: false
    }),
    'revise'
  );
  assert.equal(
    decideLoopGate({
      deterministicPassed: true,
      forceEscalation: false,
      reviewVerdict: 'revise',
      budgetExhausted: true
    }),
    'escalate'
  );
  assert.equal(
    decideLoopGate({
      deterministicPassed: true,
      forceEscalation: false,
      reviewVerdict: 'pass',
      budgetExhausted: false
    }),
    'pass'
  );
});
