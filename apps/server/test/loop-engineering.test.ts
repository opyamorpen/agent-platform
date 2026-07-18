import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AgentConfig,
  WorkflowNodeLoopPolicy
} from '@ones-ai-workflow/shared';
import {
  buildLoopCompletionComment,
  buildLoopContextXml,
  buildLoopFailureSignature,
  buildLoopRevisionComment,
  buildNextLoopAttemptUUID,
  calculateLoopBudget,
  decideLoopGate,
  isAutomaticLoopAttempt,
  isLoopEscalationCommentText,
  isLoopLifecycleCommentText,
  isSameLoopLifecycleComment,
  isLoopPolicyRuntimeEligible,
  hasRepeatedLoopFailure,
  localizeLoopDeterministicError
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
  assert.equal(
    isLoopPolicyRuntimeEligible({
      teamEnabled: true,
      policy,
      agentConfig: {
        ...config,
        acceptancePolicy: {
          ...config.acceptancePolicy,
          criteria: [],
          verificationProfileUUIDs: ['profile-1']
        }
      }
    }),
    true
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
  assert.equal(
    isLoopLifecycleCommentText('[AI自动修正][Agent][第1次尝试未通过]'),
    true
  );
  assert.equal(
    isLoopLifecycleCommentText('[AI自动修正完成][Agent][第2次尝试通过]'),
    true
  );
  assert.equal(isLoopLifecycleCommentText('人工审核意见'), false);
});

test('loop revision and completion comments explain automatic attempts', () => {
  const budget = calculateLoopBudget({
    policy,
    executionCreatedAt: new Date('2026-07-18T00:00:00Z'),
    attempts: [attempt(100, 50)],
    currentUsage: { inputTokens: 100, outputTokens: 50 },
    reviewUsage: { inputTokens: 20, outputTokens: 10 },
    now: new Date('2026-07-18T00:01:00Z')
  });
  const revisionComment = buildLoopRevisionComment({
    agentName: '需求方案设计',
    budget,
    summary: '风险和验收标准不完整。',
    failureDetails: {
      runtimeErrors: [],
      deterministicErrors: ['输出字段 UUID 无效'],
      acceptanceFindings: ['缺少风险说明', '缺少异常验收项']
    }
  });
  assert.match(revisionComment, /^\[AI自动修正\]/u);
  assert.match(revisionComment, /系统已开始第2次尝试/u);
  assert.match(revisionComment, /缺少风险说明/u);
  assert.match(revisionComment, /确定性校验错误：/u);
  assert.match(revisionComment, /验收标准未通过：/u);
  assert.doesNotMatch(revisionComment, /未通过项：/u);
  assert.match(revisionComment, /剩余预算：2 次尝试/u);

  const completionComment = buildLoopCompletionComment({
    agentName: '需求方案设计',
    attemptNumber: 2,
    summary: '候选输出已通过验收。',
    actualWrites: ['更新「需求分析报告」', '状态流转至「方案评审-人」']
  });
  assert.match(completionComment, /^\[AI自动修正完成\]/u);
  assert.match(completionComment, /第2次尝试通过/u);
  assert.match(completionComment, /更新「需求分析报告」/u);
});

test('loop deterministic errors are localized without HTML-like XML tags', () => {
  assert.equal(
    localizeLoopDeterministicError('Missing <outputs> block'),
    'Agent 输出缺少必需的 outputs 根节点'
  );
  assert.equal(
    localizeLoopDeterministicError('Missing <field-uuid> in <output> block'),
    'Agent 输出的 output 节点缺少 field-uuid 子节点'
  );
  assert.equal(
    localizeLoopDeterministicError('Unknown output field "field016"'),
    'Agent 输出包含未配置字段：field016'
  );
});

test('only automatic loop retries suppress the generic start comment', () => {
  assert.equal(
    isAutomaticLoopAttempt({
      loopContext: { source: 'automatic', attemptNumber: 2 }
    }),
    true
  );
  assert.equal(
    isAutomaticLoopAttempt({
      loopContext: { source: 'manual', attemptNumber: 2 }
    }),
    false
  );
  assert.equal(isAutomaticLoopAttempt({}), false);
});

test('loop lifecycle comment idempotency uses the stable attempt prefix', () => {
  assert.equal(
    isSameLoopLifecycleComment(
      '[AI自动修正][Agent][第1次尝试未通过]\n\n剩余 2 次',
      '[AI自动修正][Agent][第1次尝试未通过]\n\n剩余 1 次'
    ),
    true
  );
  assert.equal(
    isSameLoopLifecycleComment(
      '[AI自动修正][Agent][第1次尝试未通过]',
      '[AI自动修正完成][Agent][第2次尝试通过]'
    ),
    false
  );
});

test('loop failure signatures are stable and repeated failures stop early', () => {
  const signature = buildLoopFailureSignature({
    runtimeErrors: [],
    deterministicErrors: ['Unknown field A'],
    acceptanceFindings: ['Missing risk section']
  });
  assert.equal(
    signature,
    buildLoopFailureSignature({
      runtimeErrors: [],
      deterministicErrors: ['Unknown field A'],
      acceptanceFindings: ['Missing risk section']
    })
  );
  assert.equal(
    hasRepeatedLoopFailure({
      currentSignature: signature,
      attempts: [{ failureSignature: signature }, { failureSignature: null }]
    }),
    true
  );
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
