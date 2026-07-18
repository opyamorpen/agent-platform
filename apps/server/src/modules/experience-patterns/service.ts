import { createHash } from 'node:crypto';
import type { ExperiencePatternType } from '@ones-ai-workflow/shared';
import type { ExecutionFeedback } from '@ones-ai-workflow/shared';
import {
  findDispatchedIssueByUUID,
  findIssueExecutionHistoryByUUID,
  type IssueAgentExecutionHistoryRecord
} from '../executions/repository.js';
import {
  listExperiencePatterns,
  upsertExperiencePattern
} from './repository.js';

type LearnedFinding = {
  type: ExperiencePatternType;
  title: string;
  repairStrategy: string;
  success: boolean;
};

export async function learnExperiencePatternsFromExecutions(input: {
  teamUUID: string;
  agentUUID: string;
  agentName: string;
  records: IssueAgentExecutionHistoryRecord[];
}): Promise<void> {
  for (const record of input.records) {
    const issueExecution = await findIssueExecutionHistoryByUUID(
      record.issueExecutionUUID,
      input.teamUUID
    );
    const dispatchedIssue = issueExecution
      ? await findDispatchedIssueByUUID(
          issueExecution.dispatchedIssueUUID,
          input.teamUUID
        )
      : null;
    for (const finding of extractLearnedFindings(record)) {
      const patternKey = createHash('sha256')
        .update(
          `${input.agentUUID}:${finding.type}:${normalize(finding.title)}`
        )
        .digest('hex');
      await upsertExperiencePattern({
        teamUUID: input.teamUUID,
        patternKey,
        type: finding.type,
        agentUUID: input.agentUUID,
        agentName: input.agentName,
        workflowUUID: issueExecution?.workflowUUID ?? null,
        workflowName: issueExecution?.workflowName ?? null,
        issueTypeUUID: dispatchedIssue?.issueTypeUUID ?? null,
        title: finding.title,
        repairStrategy: finding.repairStrategy,
        success: finding.success
      });
    }
  }
}

export async function getExperiencePatterns(input: {
  teamUUID: string;
  agentUUID?: string | null;
  workflowUUID?: string | null;
}) {
  return listExperiencePatterns(input);
}

export async function learnExperiencePatternsFromFeedback(input: {
  teamUUID: string;
  agentUUID: string;
  agentName: string;
  feedback: ExecutionFeedback[];
  resolution: string;
}): Promise<void> {
  for (const feedback of input.feedback) {
    const issueExecution = await findIssueExecutionHistoryByUUID(
      feedback.issueExecutionUUID,
      input.teamUUID
    );
    const dispatchedIssue = issueExecution
      ? await findDispatchedIssueByUUID(
          issueExecution.dispatchedIssueUUID,
          input.teamUUID
        )
      : null;
    const patternKey = createHash('sha256')
      .update(`${input.agentUUID}:human_feedback:${feedback.contentHash}`)
      .digest('hex');
    await upsertExperiencePattern({
      teamUUID: input.teamUUID,
      patternKey,
      type: 'human_feedback',
      agentUUID: input.agentUUID,
      agentName: input.agentName,
      workflowUUID: issueExecution?.workflowUUID ?? null,
      workflowName: issueExecution?.workflowName ?? null,
      issueTypeUUID: dispatchedIssue?.issueTypeUUID ?? null,
      title: feedback.excerpt,
      repairStrategy: input.resolution,
      success: true
    });
  }
}

export async function learnKnowledgeGap(input: {
  teamUUID: string;
  agentUUID: string;
  agentName: string;
  issueExecutionUUID?: string | null;
  message: string;
}): Promise<void> {
  const issueExecution = input.issueExecutionUUID
    ? await findIssueExecutionHistoryByUUID(
        input.issueExecutionUUID,
        input.teamUUID
      )
    : null;
  const dispatchedIssue = issueExecution
    ? await findDispatchedIssueByUUID(
        issueExecution.dispatchedIssueUUID,
        input.teamUUID
      )
    : null;
  const title = input.message.replace(/\s+/gu, ' ').trim().slice(0, 512);
  const patternKey = createHash('sha256')
    .update(`${input.agentUUID}:knowledge_gap:${normalize(title)}`)
    .digest('hex');
  await upsertExperiencePattern({
    teamUUID: input.teamUUID,
    patternKey,
    type: 'knowledge_gap',
    agentUUID: input.agentUUID,
    agentName: input.agentName,
    workflowUUID: issueExecution?.workflowUUID ?? null,
    workflowName: issueExecution?.workflowName ?? null,
    issueTypeUUID: dispatchedIssue?.issueTypeUUID ?? null,
    title,
    repairStrategy: '检查知识源权限、索引状态、查询范围和必需知识配置。',
    success: false
  });
}

function extractLearnedFindings(
  record: IssueAgentExecutionHistoryRecord
): LearnedFinding[] {
  const result = asRecord(record.executeResult);
  const loopEvaluation = asRecord(result?.loopEvaluation);
  const failureDetails = asRecord(loopEvaluation?.failureDetails);
  const findings: LearnedFinding[] = [];

  for (const value of asStrings(failureDetails?.deterministicErrors)) {
    findings.push({
      type: 'deterministic_error',
      title: value,
      repairStrategy: '严格使用已配置字段、输出类型和确定性输出协议。',
      success: false
    });
  }
  for (const value of asStrings(failureDetails?.acceptanceFindings)) {
    const [title, repairStrategy = '按验收标准补充缺失内容。'] = value.split(
      /；修改要求：/u,
      2
    );
    findings.push({
      type: 'acceptance_failure',
      title: title || value,
      repairStrategy,
      success: false
    });
  }
  const verificationResults = Array.isArray(result?.verificationResults)
    ? result.verificationResults
    : [];
  for (const profile of verificationResults) {
    const profileRecord = asRecord(profile);
    const steps = Array.isArray(profileRecord?.steps)
      ? profileRecord.steps
      : [];
    for (const step of steps) {
      const stepRecord = asRecord(step);
      if (stepRecord?.status === 'passed') continue;
      const title = `${String(profileRecord?.profileName ?? '代码验证')} / ${String(stepRecord?.stepName ?? '步骤')} 未通过`;
      findings.push({
        type: 'verification_failure',
        title,
        repairStrategy: String(
          stepRecord?.stderr ?? '修复验证步骤后重新执行。'
        ),
        success: false
      });
    }
  }
  return findings;
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
