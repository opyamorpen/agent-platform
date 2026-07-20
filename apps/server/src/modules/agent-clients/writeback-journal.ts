import { createHash } from 'node:crypto';
import type { AgentClientTaskReport } from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

export interface WritebackJournal {
  version: 1;
  taskUUID: string;
  reportHash: string;
  state: 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
}

interface WritebackJournalDependencies {
  read: (teamUUID: string, taskUUID: string) => Promise<WritebackJournal | null>;
  write: (
    teamUUID: string,
    taskUUID: string,
    journal: WritebackJournal
  ) => Promise<void>;
}

export class TaskReportConflictError extends Error {
  constructor(taskUUID: string) {
    super(`A different terminal report was already accepted for task ${taskUUID}`);
    this.name = 'TaskReportConflictError';
  }
}

export class WritebackStateUnknownError extends Error {
  constructor(taskUUID: string) {
    super(`Write-back outcome is unknown for task ${taskUUID}`);
    this.name = 'WritebackStateUnknownError';
  }
}

function getJournalKey(teamUUID: string, taskUUID: string): string {
  return buildHostedObjectKey('execution-writeback', teamUUID, taskUUID);
}

export function hashTaskReport(report: AgentClientTaskReport): string {
  return createHash('sha256')
    .update(JSON.stringify({
      taskUUID: report.taskUUID,
      claimToken: report.claimToken ?? null,
      status: report.status,
      logs: report.logs,
      executeResult: report.executeResult,
      attachmentUploads: report.attachmentUploads ?? [],
      usage: report.usage,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt
    }))
    .digest('hex');
}

export async function readWritebackJournal(
  teamUUID: string,
  taskUUID: string
): Promise<WritebackJournal | null> {
  return readObjectJson<WritebackJournal>(getJournalKey(teamUUID, taskUUID));
}

export async function beginWriteback(
  teamUUID: string,
  report: AgentClientTaskReport,
  now: Date,
  dependencies: WritebackJournalDependencies = defaultDependencies
): Promise<'started' | 'duplicate'> {
  const reportHash = hashTaskReport(report);
  const current = await dependencies.read(teamUUID, report.taskUUID);
  if (current) {
    if (current.reportHash !== reportHash) {
      throw new TaskReportConflictError(report.taskUUID);
    }
    if (current.state === 'completed') return 'duplicate';
    if (current.state === 'in_progress') {
      throw new WritebackStateUnknownError(report.taskUUID);
    }
  }
  await dependencies.write(teamUUID, report.taskUUID, {
    version: 1,
    taskUUID: report.taskUUID,
    reportHash,
    state: 'in_progress',
    startedAt: now.toISOString(),
    completedAt: null
  } satisfies WritebackJournal);
  return 'started';
}

export async function completeWriteback(
  teamUUID: string,
  report: AgentClientTaskReport,
  now: Date,
  dependencies: WritebackJournalDependencies = defaultDependencies
): Promise<void> {
  const current = await dependencies.read(teamUUID, report.taskUUID);
  if (!current || current.reportHash !== hashTaskReport(report)) {
    throw new TaskReportConflictError(report.taskUUID);
  }
  await dependencies.write(teamUUID, report.taskUUID, {
    ...current,
    state: 'completed',
    completedAt: now.toISOString()
  } satisfies WritebackJournal);
}

const defaultDependencies: WritebackJournalDependencies = {
  read: readWritebackJournal,
  write: async (teamUUID, taskUUID, journal) => {
    await uploadObjectJson(getJournalKey(teamUUID, taskUUID), journal);
  }
};
