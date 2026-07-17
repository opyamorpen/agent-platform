import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertRevisionFeedbackPresent,
  getRevisionFeedbackInWindow,
  RevisionContextBuildError
} from '../src/modules/executions/revision-context.js';

test('revision feedback uses the post-result review window and excludes lifecycle comments', () => {
  const feedback = getRevisionFeedbackInWindow(
    [
      {
        id: 'before',
        text: '旧意见',
        createTime: String(Date.parse('2026-07-17T01:00:00Z') / 1000),
        owner: { id: 'user-1', name: 'Reviewer' }
      },
      {
        id: 'system',
        text: '[Agent] 已开始工作，稍后通知你结果。',
        createTime: String(Date.parse('2026-07-17T02:30:00Z') / 1000),
        owner: { id: 'agent-user', name: 'Agent User' }
      },
      {
        id: 'revision-summary',
        text: '[AI返工摘要][Agent][第2轮]\n\n已完成返工。',
        createTime: String(Date.parse('2026-07-17T02:45:00Z') / 1000),
        owner: { id: 'agent-user', name: 'Agent User' }
      },
      {
        id: 'review',
        text: '请补充验收条件',
        createTime: String(Date.parse('2026-07-17T03:00:00Z') / 1000),
        owner: { id: 'user-1', name: 'Reviewer' }
      }
    ],
    new Date('2026-07-17T02:00:00Z'),
    new Date('2026-07-17T04:00:00Z')
  );

  assert.deepEqual(
    feedback.map((comment) => comment.id),
    ['review']
  );
});

test('revision feedback is required before a revision task runs', () => {
  assert.throws(
    () => assertRevisionFeedbackPresent([]),
    (error: unknown) =>
      error instanceof RevisionContextBuildError &&
      error.code === 'revision_feedback_missing'
  );
});
