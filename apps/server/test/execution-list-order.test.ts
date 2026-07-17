import assert from 'node:assert/strict';
import test from 'node:test';
import { compareDispatchedIssuesByLatestExecution } from '../src/modules/executions/service.js';

test('dispatched issues sort by latest execution time descending', () => {
  const issues = [
    {
      uuid: 'issue-old',
      lastDispatchedAt: '2026-07-16T03:09:54.000Z',
      updatedAt: '2026-07-17T12:00:00.000Z'
    },
    {
      uuid: 'issue-new',
      lastDispatchedAt: '2026-07-17T11:49:46.000Z',
      updatedAt: '2026-07-17T11:49:46.000Z'
    },
    {
      uuid: 'issue-never-run',
      lastDispatchedAt: null,
      updatedAt: '2026-07-17T13:00:00.000Z'
    }
  ];

  assert.deepEqual(
    issues.sort(compareDispatchedIssuesByLatestExecution).map((issue) => issue.uuid),
    ['issue-new', 'issue-old', 'issue-never-run']
  );
});

test('dispatched issue ordering is stable when execution times match', () => {
  const issues = [
    {
      uuid: 'issue-b',
      lastDispatchedAt: '2026-07-17T11:49:46.000Z',
      updatedAt: '2026-07-17T12:00:00.000Z'
    },
    {
      uuid: 'issue-c',
      lastDispatchedAt: '2026-07-17T11:49:46.000Z',
      updatedAt: '2026-07-17T13:00:00.000Z'
    },
    {
      uuid: 'issue-a',
      lastDispatchedAt: '2026-07-17T11:49:46.000Z',
      updatedAt: '2026-07-17T12:00:00.000Z'
    }
  ];

  assert.deepEqual(
    issues.sort(compareDispatchedIssuesByLatestExecution).map((issue) => issue.uuid),
    ['issue-c', 'issue-a', 'issue-b']
  );
});
