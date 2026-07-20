import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentClientTaskReport } from '@ones-ai-workflow/shared';
import {
  beginWriteback,
  completeWriteback,
  hashTaskReport,
  TaskReportConflictError,
  type WritebackJournal,
  WritebackStateUnknownError
} from '../src/modules/agent-clients/writeback-journal.ts';

function createReport(executeResult = '<outputs />'): AgentClientTaskReport {
  return {
    taskUUID: 'task-1',
    claimToken: 'claim-1',
    status: 'success',
    logs: 'done',
    executeResult,
    usage: null,
    startedAt: '2026-07-20T00:00:00.000Z',
    finishedAt: '2026-07-20T00:01:00.000Z'
  };
}

function createStore(initial: WritebackJournal | null = null) {
  let current = initial;
  return {
    dependencies: {
      read: async () => current,
      write: async (
        _teamUUID: string,
        _taskUUID: string,
        journal: WritebackJournal
      ) => {
        current = journal;
      }
    },
    read: () => current
  };
}

test('writeback journal accepts an identical completed terminal report', async () => {
  const report = createReport();
  const store = createStore();
  assert.equal(
    await beginWriteback('team-1', report, new Date('2026-07-20T00:01:00Z'), store.dependencies),
    'started'
  );
  await completeWriteback(
    'team-1',
    report,
    new Date('2026-07-20T00:01:01Z'),
    store.dependencies
  );
  assert.equal(store.read()?.state, 'completed');
  assert.equal(
    await beginWriteback('team-1', report, new Date('2026-07-20T00:01:02Z'), store.dependencies),
    'duplicate'
  );
});

test('writeback journal rejects conflicting or uncertain terminal reports', async () => {
  const report = createReport();
  const inProgress: WritebackJournal = {
    version: 1,
    taskUUID: report.taskUUID,
    reportHash: hashTaskReport(report),
    state: 'in_progress',
    startedAt: '2026-07-20T00:01:00.000Z',
    completedAt: null
  };
  const store = createStore(inProgress);

  await assert.rejects(
    () => beginWriteback('team-1', report, new Date(), store.dependencies),
    WritebackStateUnknownError
  );
  await assert.rejects(
    () => beginWriteback('team-1', createReport('<outputs>changed</outputs>'), new Date(), store.dependencies),
    TaskReportConflictError
  );
});
