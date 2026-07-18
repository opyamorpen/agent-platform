import { Buffer } from 'node:buffer';
import type { AgentConfig } from '@ones-ai-workflow/shared';
import type { OnesOpenApiContext } from '../../ones/context.js';
import {
  getIssueFieldValues,
  ISSUE_ATTACHMENT_FIELD_UUID,
  ISSUE_COMMENT_FIELD_UUID,
  listIssueComments
} from '../../ones/issue.js';
import type { OnesOpenApiIssueComment } from '../../ones/open-api/types.js';
import { createOnesOpenApiClient } from '../../ones/index.js';
import type { IssueExecutionHistoryRecord } from './repository.js';
import { isRevisionSummaryCommentText } from './revision-summary.js';
import { isLoopLifecycleCommentText } from './loop-engineering.js';

const MAX_COMMENT_COUNT = 1000;
const MAX_COMMENT_SCAN_BYTES = 1024 * 1024;
const MAX_REVISION_CONTEXT_BYTES = 256 * 1024;
const OLD_RESULT_SUMMARY_CHARS = 8000;
const OLD_FEEDBACK_SUMMARY_CHARS = 8000;

export type RevisionContextErrorCode =
  | 'revision_feedback_missing'
  | 'revision_context_too_large'
  | 'revision_feedback_limit_exceeded'
  | 'revision_history_load_failed';

export class RevisionContextBuildError extends Error {
  constructor(
    public readonly code: RevisionContextErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RevisionContextBuildError';
  }
}

export interface AppliedWriteSnapshot {
  fieldUUID: string;
  fieldName: string;
  valueType: string;
  referenceObjectType: string | null;
  value: unknown;
}

export interface RevisionRuntimeContext {
  xml: string;
  metadata: {
    mode: 'revision';
    iteration: number;
    previousExecutionUUID: string;
    historyExecutionUUIDs: string[];
    feedbackCommentCount: number;
    snapshotAt: string;
    currentOutputs: AppliedWriteSnapshot[];
    currentWikiPages: Array<{
      fieldUUID: string;
      uuid: string;
      title: string;
      spaceUUID: string;
      updatedTime: number;
      refType: string;
    }>;
  };
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapXmlCdata(value: string): string {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function truncate(value: string, maxChars: number): string {
  return value.length <= maxChars
    ? value
    : `${value.slice(0, maxChars)}\n[summary truncated]`;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseOnesTimestamp(value?: string): number {
  const numericValue = Number(value?.trim());
  if (!Number.isFinite(numericValue)) {
    return Number.NaN;
  }

  if (Math.abs(numericValue) >= 1e15) {
    return numericValue / 1000;
  }
  if (Math.abs(numericValue) < 1e11) {
    return numericValue * 1000;
  }
  return numericValue;
}

export function isPluginLifecycleComment(
  comment: OnesOpenApiIssueComment
): boolean {
  const text = comment.text.trim();
  return (
    isRevisionSummaryCommentText(text) ||
    isLoopLifecycleCommentText(text) ||
    /^\[[^\]]+\] 已开始工作，稍后通知你结果。$/u.test(text) ||
    /^\[[^\]]+\] 执行阻塞，联系管理员处理。$/u.test(text)
  );
}

function getLatestAgentExecution(execution: IssueExecutionHistoryRecord) {
  return execution.agentExecutions.at(-1) ?? null;
}

function extractRefUUIDs(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      values.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return [];
        }
        const uuid = (item as { uuid?: unknown }).uuid;
        return typeof uuid === 'string' && uuid.trim() ? [uuid.trim()] : [];
      })
    )
  );
}

function formatComment(comment: OnesOpenApiIssueComment): string {
  const timestamp = parseOnesTimestamp(comment.createTime);
  const createdAt = Number.isNaN(timestamp)
    ? comment.createTime || 'unknown-time'
    : new Date(timestamp).toISOString();
  const owner =
    comment.owner?.name?.trim() || comment.owner?.id?.trim() || 'unknown-user';
  return `[${createdAt} | ${owner} | ${comment.id}]\n${comment.text.trim()}`;
}

export function getRevisionFeedbackInWindow(
  comments: OnesOpenApiIssueComment[],
  startAt: Date,
  endAt: Date
): OnesOpenApiIssueComment[] {
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();

  return comments.filter((comment) => {
    if (isPluginLifecycleComment(comment)) {
      return false;
    }
    const timestamp = parseOnesTimestamp(comment.createTime);
    if (Number.isNaN(timestamp)) {
      throw new RevisionContextBuildError(
        'revision_history_load_failed',
        `Comment ${comment.id} is missing a valid creation time`
      );
    }
    return timestamp > startMs && timestamp <= endMs;
  });
}

export function assertRevisionFeedbackPresent(
  feedback: OnesOpenApiIssueComment[]
): void {
  if (feedback.length === 0) {
    throw new RevisionContextBuildError(
      'revision_feedback_missing',
      'No new human review comment was found after the previous successful execution'
    );
  }
}

export async function loadAppliedWriteSnapshot(
  issueUUID: string,
  outputs: AgentConfig['outputs'],
  onesContext: OnesOpenApiContext
): Promise<AppliedWriteSnapshot[]> {
  const fields = Array.from(
    new Map(
      outputs
        .filter(
          (output) =>
            output.field.uuid !== ISSUE_COMMENT_FIELD_UUID &&
            output.field.uuid !== ISSUE_ATTACHMENT_FIELD_UUID &&
            output.field.referenceObjectType !== 'attachment'
        )
        .map((output) => [output.field.uuid, output.field] as const)
    ).values()
  );

  if (fields.length === 0) {
    return [];
  }

  const values = await getIssueFieldValues(
    issueUUID,
    fields.map((field) => ({
      uuid: field.uuid,
      alias: field.uuid,
      valueType: field.valueType,
      referenceObjectType: field.referenceObjectType
    })),
    onesContext
  );

  if (!values) {
    throw new RevisionContextBuildError(
      'revision_history_load_failed',
      `ONES issue not found when loading applied outputs: ${issueUUID}`
    );
  }

  return fields.map((field) => ({
    fieldUUID: field.uuid,
    fieldName: field.name,
    valueType: field.valueType,
    referenceObjectType: field.referenceObjectType,
    value: values[field.uuid] ?? null
  }));
}

function renderIteration(input: {
  execution: IssueExecutionHistoryRecord;
  feedback: OnesOpenApiIssueComment[];
  full: boolean;
}): string {
  const agentExecution = getLatestAgentExecution(input.execution);
  const rawResult =
    agentExecution?.rawExecuteResult.trim() ||
    stringify(agentExecution?.executeResult ?? {});
  const feedbackText = input.feedback.map(formatComment).join('\n\n');
  const result = input.full
    ? rawResult
    : truncate(rawResult, OLD_RESULT_SUMMARY_CHARS);
  const feedback = input.full
    ? feedbackText
    : truncate(feedbackText, OLD_FEEDBACK_SUMMARY_CHARS);

  return [
    '    <iteration>',
    `      <number>${input.execution.iteration}</number>`,
    `      <execution-uuid>${escapeXmlText(input.execution.uuid)}</execution-uuid>`,
    `      <agent-version>${agentExecution?.agentVersion ?? 0}</agent-version>`,
    `      <finished-at>${escapeXmlText(input.execution.finishedAt?.toISOString() ?? '')}</finished-at>`,
    `      <result-format>${input.full ? 'full' : 'structured-summary'}</result-format>`,
    `      <result>${wrapXmlCdata(result)}</result>`,
    `      <review-feedback-count>${input.feedback.length}</review-feedback-count>`,
    `      <review-feedback>${wrapXmlCdata(feedback)}</review-feedback>`,
    '    </iteration>'
  ].join('\n');
}

export async function buildRevisionRuntimeContext(input: {
  currentExecution: IssueExecutionHistoryRecord;
  allExecutions: IssueExecutionHistoryRecord[];
  agentConfig: AgentConfig;
  onesContext: OnesOpenApiContext;
  snapshotAt?: Date;
}): Promise<RevisionRuntimeContext | null> {
  if (
    input.currentExecution.triggerReason !== 'revision' ||
    !input.currentExecution.previousExecutionUUID
  ) {
    return null;
  }

  const snapshotAt = input.snapshotAt ?? new Date();
  const successfulExecutions = input.allExecutions
    .filter(
      (execution) =>
        execution.uuid !== input.currentExecution.uuid &&
        execution.workflowNodeUUID ===
          input.currentExecution.workflowNodeUUID &&
        execution.status === 'success' &&
        execution.finishedAt
    )
    .sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
    );

  if (successfulExecutions.length === 0) {
    throw new RevisionContextBuildError(
      'revision_history_load_failed',
      'No successful prior execution was found for the revision run'
    );
  }

  const comments = await listIssueComments(
    input.currentExecution.dispatchedIssueUUID,
    input.onesContext,
    MAX_COMMENT_COUNT + 1
  );
  if (comments.length > MAX_COMMENT_COUNT) {
    throw new RevisionContextBuildError(
      'revision_feedback_limit_exceeded',
      `Issue comment count exceeds ${MAX_COMMENT_COUNT}`
    );
  }
  if (Buffer.byteLength(stringify(comments), 'utf8') > MAX_COMMENT_SCAN_BYTES) {
    throw new RevisionContextBuildError(
      'revision_feedback_limit_exceeded',
      'Issue comments exceed the revision feedback scan limit'
    );
  }

  const feedbackByExecution = successfulExecutions.map((execution, index) => {
    const finishedAt = execution.finishedAt;
    if (!finishedAt) {
      return [];
    }
    const nextExecution = successfulExecutions[index + 1];
    const nextAgentExecution = nextExecution
      ? getLatestAgentExecution(nextExecution)
      : null;
    const endAt =
      nextAgentExecution?.queuedAt ?? nextExecution?.createdAt ?? snapshotAt;
    return getRevisionFeedbackInWindow(comments, finishedAt, endAt);
  });
  const latestFeedback = feedbackByExecution.at(-1) ?? [];
  assertRevisionFeedbackPresent(latestFeedback);

  const currentOutputs = await loadAppliedWriteSnapshot(
    input.currentExecution.dispatchedIssueUUID,
    input.agentConfig.outputs,
    input.onesContext
  );
  const wikiClient = await createOnesOpenApiClient(input.onesContext);
  const currentWikiPages = (
    await Promise.all(
      currentOutputs
        .filter(
          (output) =>
            output.referenceObjectType === 'wiki_page' ||
            output.referenceObjectType === 'wiki'
        )
        .flatMap((output) =>
          extractRefUUIDs(output.value).map(async (uuid) => {
            const page = await wikiClient.getWikiPage(uuid);
            return {
              fieldUUID: output.fieldUUID,
              uuid: page.id,
              title: page.title,
              spaceUUID: page.spaceID,
              updatedTime: page.updatedTime,
              refType: page.refType
            };
          })
        )
    )
  ).flat();
  const iterationXml = successfulExecutions.map((execution, index) =>
    renderIteration({
      execution,
      feedback: feedbackByExecution[index] ?? [],
      full: index === successfulExecutions.length - 1
    })
  );
  const xml = [
    '<revision-context>',
    '  <mode>revision</mode>',
    `  <current-iteration>${input.currentExecution.iteration}</current-iteration>`,
    `  <previous-execution-uuid>${escapeXmlText(input.currentExecution.previousExecutionUUID)}</previous-execution-uuid>`,
    '  <instructions>',
    '    This is a revision run. Update the existing result according to the review feedback instead of starting over.',
    '    Current work-item inputs are authoritative. Newer review feedback takes precedence over older feedback.',
    '    Reuse existing target object UUIDs shown in current-applied-outputs. Do not create duplicate Wiki pages or referenced objects.',
    '  </instructions>',
    `  <current-applied-outputs>${wrapXmlCdata(stringify({ fields: currentOutputs, wikiPages: currentWikiPages }))}</current-applied-outputs>`,
    '  <previous-iterations>',
    ...iterationXml,
    '  </previous-iterations>',
    '</revision-context>'
  ].join('\n');

  if (Buffer.byteLength(xml, 'utf8') > MAX_REVISION_CONTEXT_BYTES) {
    throw new RevisionContextBuildError(
      'revision_context_too_large',
      `Revision context exceeds ${MAX_REVISION_CONTEXT_BYTES} bytes`
    );
  }

  return {
    xml,
    metadata: {
      mode: 'revision',
      iteration: input.currentExecution.iteration,
      previousExecutionUUID: input.currentExecution.previousExecutionUUID,
      historyExecutionUUIDs: successfulExecutions.map(
        (execution) => execution.uuid
      ),
      feedbackCommentCount: latestFeedback.length,
      snapshotAt: snapshotAt.toISOString(),
      currentOutputs,
      currentWikiPages
    }
  };
}
