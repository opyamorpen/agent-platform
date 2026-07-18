import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  DispatchedIssue,
  IssueAgentExecutionHistory,
  IssueExecutionHistory,
  IssueExecutionStatus,
  RefObject
} from '@ones-ai-workflow/shared';
import { getLogger } from '../../lib/logger.js';
import { resolveCurrentInstallationInfo } from '../../lib/installation-info.js';
import { buildOnesIssueURL } from '../../lib/ones-url.js';
import type { OnesOpenApiContext } from '../../ones/context.js';
import {
  listWorkflowIssues,
  type ListAssignedIssuesFilter,
  type OnesIssue
} from '../../ones/issue.js';
import {
  findAgentByUUID,
  findAgentVersions,
  findDispatchAgentsByUUIDs,
  type DispatchAgentRecord
} from '../agents/repository.js';
import {
  deleteDispatchedIssueByUUID,
  deleteIssueAgentExecutionHistoryByUUID,
  deleteIssueExecutionHistoryByUUID,
  createIssueAgentExecutionHistories,
  createIssueExecutionHistory,
  findActiveIssueExecutionHistoryByDispatchedIssueUUID,
  findIssueAgentExecutionHistoryByUUID,
  findDispatchedIssueByUUID,
  findIssueExecutionHistoryByUUID,
  listDispatchedIssues,
  listIssueExecutionHistoriesByDispatchedIssueUUID,
  updateIssueAgentExecutionHistory,
  updateIssueExecutionHistory,
  type JsonObject,
  type DispatchedIssueRecord,
  type IssueAgentExecutionHistoryRecord,
  type IssueExecutionHistoryRecord,
  updateDispatchedIssueLatestExecution,
  upsertDispatchedIssue
} from './repository.js';
import {
  listAllWorkflowNodes,
  listWorkflows
} from '../workflows/repository.js';

const ONES_ISSUE_LIMIT = 200;
const logger = getLogger('workflow-execution.service');

export class DispatchedIssueNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Dispatched issue not found: ${uuid}`);
    this.name = 'DispatchedIssueNotFoundError';
  }
}

export class IssueExecutionHistoryNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Issue execution history not found: ${uuid}`);
    this.name = 'IssueExecutionHistoryNotFoundError';
  }
}

export class IssueAgentExecutionHistoryNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Issue agent execution history not found: ${uuid}`);
    this.name = 'IssueAgentExecutionHistoryNotFoundError';
  }
}

export class IssueAgentExecutionHistoryRetryNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IssueAgentExecutionHistoryRetryNotAllowedError';
  }
}

type ExecutableWorkflowNode = {
  uuid: string;
  workflow: RefObject;
  project: RefObject;
  issueType: RefObject;
  status: RefObject;
  executor: RefObject;
  agents: DispatchAgentRecord[];
  revisionContextEnabled: boolean;
};

async function loadExecutableWorkflowNodes(
  teamUUID: string
): Promise<ExecutableWorkflowNode[]> {
  const [workflows, workflowNodes] = await Promise.all([
    listWorkflows(teamUUID),
    listAllWorkflowNodes(teamUUID)
  ]);

  if (workflows.length === 0 || workflowNodes.length === 0) {
    return [];
  }

  const allWorkflowMap = new Map(
    workflows.map((workflow) => [workflow.uuid, workflow])
  );
  const workflowMap = new Map(
    workflows
      .filter((workflow) => workflow.isActive)
      .map((workflow) => [workflow.uuid, workflow])
  );
  const agentUUIDs = Array.from(
    new Set(workflowNodes.map((node) => node.agentUUID).filter(Boolean))
  );
  const agents = await findDispatchAgentsByUUIDs(agentUUIDs, teamUUID);
  const agentMap = new Map(agents.map((agent) => [agent.uuid, agent] as const));

  return workflowNodes.flatMap((node) => {
    const workflow = workflowMap.get(node.workflowUUID);
    const referencedWorkflow = allWorkflowMap.get(node.workflowUUID);

    if (!workflow) {
      if (!referencedWorkflow) {
        logger.error(
          '[workflow-execution] skip node because workflow is missing',
          {
            workflowUUID: node.workflowUUID,
            workflowNodeUUID: node.uuid,
            projectName: node.projectName,
            issueTypeName: node.issueTypeName,
            statusName: node.statusName
          }
        );
      }

      return [];
    }

    const nodeAgent = agentMap.get(node.agentUUID);

    if (!nodeAgent) {
      logger.error(
        '[workflow-execution] skip node because bound agent is missing',
        {
          workflowUUID: node.workflowUUID,
          workflowNodeUUID: node.uuid,
          agentUUID: node.agentUUID
        }
      );
      return [];
    }

    if (!nodeAgent.executor) {
      logger.error(
        '[workflow-execution] skip node because bound agent has no executor',
        {
          workflowUUID: node.workflowUUID,
          workflowNodeUUID: node.uuid,
          agentUUID: nodeAgent.uuid
        }
      );
      return [];
    }

    return [
      {
        uuid: node.uuid,
        workflow: {
          uuid: workflow.uuid,
          name: workflow.name
        },
        project: {
          uuid: node.projectUUID,
          name: node.projectName
        },
        issueType: {
          uuid: node.issueTypeUUID,
          name: node.issueTypeName
        },
        status: {
          uuid: node.statusUUID,
          name: node.statusName
        },
        executor: nodeAgent.executor as RefObject,
        agents: [nodeAgent],
        revisionContextEnabled: node.revisionContext.enabled
      }
    ];
  });
}

function matchIssueToWorkflowNode(
  issue: OnesIssue,
  workflowNode: ExecutableWorkflowNode
): boolean {
  return (
    issue.project.uuid === workflowNode.project.uuid &&
    issue.issueType.uuid === workflowNode.issueType.uuid &&
    issue.status.uuid === workflowNode.status.uuid
  );
}

function getMatchingWorkflowNodes(
  issue: OnesIssue,
  workflowNodes: ExecutableWorkflowNode[]
): ExecutableWorkflowNode[] {
  return workflowNodes.filter((workflowNode) =>
    matchIssueToWorkflowNode(issue, workflowNode)
  );
}

function getAssignedIssueFilters(
  workflowNodes: ExecutableWorkflowNode[]
): ListAssignedIssuesFilter[] {
  return Array.from(
    new Map(
      workflowNodes.map((workflowNode) => {
        const filter = {
          projectUUID: workflowNode.project.uuid,
          issueTypeUUID: workflowNode.issueType.uuid,
          statusUUID: workflowNode.status.uuid
        };

        return [
          `${filter.projectUUID}:${filter.issueTypeUUID}:${filter.statusUUID}`,
          filter
        ] as const;
      })
    ).values()
  );
}

function toDispatchedIssue(
  record: DispatchedIssueRecord,
  onesConfig: {
    onesBaseUrl: string | null;
    teamUUID: string | null;
  }
) {
  return {
    uuid: record.uuid,
    displayId: record.displayId,
    name: record.name,
    project: {
      uuid: record.projectUUID,
      name: record.projectName
    },
    issueType: {
      uuid: record.issueTypeUUID,
      name: record.issueTypeName
    },
    status: {
      uuid: record.statusUUID,
      name: record.statusName
    },
    assignee: {
      uuid: record.assigneeUUID,
      name: record.assigneeName
    },
    onesURL: buildOnesIssueURL(record.displayId, onesConfig),
    latestExecutionUUID: record.latestExecutionUUID,
    latestExecutionStatus:
      record.latestExecutionStatus as DispatchedIssue['latestExecutionStatus'],
    lastDispatchedAt: record.lastDispatchedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toIssueAgentExecutionHistorySummary(
  agentExecution: IssueAgentExecutionHistoryRecord
): IssueAgentExecutionHistory {
  return {
    uuid: agentExecution.uuid,
    agent: {
      uuid: agentExecution.agentUUID,
      name: agentExecution.agentName
    },
    executor:
      agentExecution.executorUUID && agentExecution.executorName
        ? {
            uuid: agentExecution.executorUUID,
            name: agentExecution.executorName
          }
        : null,
    agentVersion: agentExecution.agentVersion,
    executePayload:
      typeof agentExecution.executePayload === 'object' &&
      agentExecution.executePayload !== null &&
      !Array.isArray(agentExecution.executePayload)
        ? (agentExecution.executePayload as Record<string, unknown>)
        : {},
    executeResult:
      typeof agentExecution.executeResult === 'object' &&
      agentExecution.executeResult !== null &&
      !Array.isArray(agentExecution.executeResult)
        ? (agentExecution.executeResult as Record<string, unknown>)
        : {},
    rawExecuteResult: agentExecution.rawExecuteResult,
    status: agentExecution.status as IssueAgentExecutionHistory['status'],
    usage: {
      inputTokens: agentExecution.usageInputTokens,
      outputTokens: agentExecution.usageOutputTokens
    },
    executeClient:
      agentExecution.executeClientUUID && agentExecution.executeClientName
        ? {
            uuid: agentExecution.executeClientUUID,
            name: agentExecution.executeClientName
          }
        : null,
    createdAt: agentExecution.createdAt.toISOString(),
    startedAt: agentExecution.startedAt?.toISOString() ?? null,
    finishedAt: agentExecution.finishedAt?.toISOString() ?? null
  };
}

function toIssueAgentExecutionHistory(
  agentExecution: IssueAgentExecutionHistoryRecord
): IssueAgentExecutionHistory {
  return {
    ...toIssueAgentExecutionHistorySummary(agentExecution),
    prompt: agentExecution.prompt,
    logs: agentExecution.logs
  };
}

function toIssueExecutionHistorySummary(
  record: IssueExecutionHistoryRecord
): IssueExecutionHistory {
  return {
    uuid: record.uuid,
    dispatchedIssueUUID: record.dispatchedIssueUUID,
    status: record.status as IssueExecutionHistory['status'],
    workflow: {
      uuid: record.workflowUUID,
      name: record.workflowName
    },
    workflowNode: {
      uuid: record.workflowNodeUUID,
      name: record.workflowNodeName
    },
    iteration: record.iteration,
    triggerReason: record.triggerReason,
    previousExecutionUUID: record.previousExecutionUUID,
    createdAt: record.createdAt.toISOString(),
    currentAgentUUID: record.currentAgentUUID,
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
    agentExecutions: record.agentExecutions.map(
      toIssueAgentExecutionHistorySummary
    )
  };
}

function toIssueExecutionHistory(
  record: IssueExecutionHistoryRecord
): IssueExecutionHistory {
  return {
    ...toIssueExecutionHistorySummary(record),
    agentExecutions: record.agentExecutions.map(toIssueAgentExecutionHistory)
  };
}

function getLatestAgentExecution(
  issueExecution: IssueExecutionHistoryRecord
): IssueAgentExecutionHistoryRecord | null {
  return issueExecution.agentExecutions.at(-1) ?? null;
}

function getExecutionFinishedAt(
  issueExecution: IssueExecutionHistoryRecord
): Date | null {
  return getLatestAgentExecution(issueExecution)?.finishedAt ?? null;
}

function getExecutionStartedAt(
  issueExecution: IssueExecutionHistoryRecord
): Date | null {
  return getLatestAgentExecution(issueExecution)?.startedAt ?? null;
}

export function getExecutionStatus(
  issueExecution: IssueExecutionHistoryRecord
): IssueExecutionStatus {
  const latestAgentExecution = getLatestAgentExecution(issueExecution);

  if (!latestAgentExecution) {
    return 'created';
  }

  if (
    latestAgentExecution.status === 'queued' ||
    latestAgentExecution.status === 'running'
  ) {
    return 'executing';
  }

  if (
    latestAgentExecution.status === 'success' ||
    latestAgentExecution.status === 'failure' ||
    latestAgentExecution.status === 'blocked' ||
    latestAgentExecution.status === 'created'
  ) {
    return latestAgentExecution.status;
  }

  return 'created';
}

function isBlockedOnCurrentTrigger(
  issue: OnesIssue,
  workflowNode: ExecutableWorkflowNode,
  issueExecution: IssueExecutionHistoryRecord
): boolean {
  return (
    issueExecution.status === 'blocked' &&
    issueExecution.workflowNodeUUID === workflowNode.uuid &&
    issueExecution.triggerStatusUUID === issue.status.uuid &&
    issueExecution.triggerAssigneeUUID === issue.assignee.uuid
  );
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  return value as JsonObject;
}

async function refreshIssueExecutionAggregate(
  issueExecutionUUID: string,
  teamUUID: string
) {
  const issueExecution = await findIssueExecutionHistoryByUUID(
    issueExecutionUUID,
    teamUUID
  );

  if (!issueExecution) {
    throw new IssueExecutionHistoryNotFoundError(issueExecutionUUID);
  }

  const workflowNodes = await listAllWorkflowNodes(teamUUID);
  const workflowNode = workflowNodes.find(
    (node) => node.uuid === issueExecution.workflowNodeUUID
  );

  if (!workflowNode) {
    throw new IssueExecutionHistoryNotFoundError(
      issueExecution.workflowNodeUUID
    );
  }

  const status = getExecutionStatus(issueExecution);
  const currentAgentUUID = workflowNode.agentUUID;
  const startedAt = getExecutionStartedAt(issueExecution);
  const finishedAt =
    status === 'success' || status === 'failure' || status === 'blocked'
      ? getExecutionFinishedAt(issueExecution)
      : null;

  await updateIssueExecutionHistory(
    {
      uuid: issueExecution.uuid,
      status,
      blockReason:
        status === 'blocked' ? (issueExecution.blockReason ?? 'blocked') : null,
      currentAgentUUID,
      startedAt,
      finishedAt
    },
    teamUUID
  );

  await updateDispatchedIssueLatestExecution(
    {
      uuid: issueExecution.dispatchedIssueUUID,
      latestExecutionUUID: issueExecution.uuid,
      latestExecutionStatus: status
    },
    teamUUID
  );
}

export function canRetryIssueAgentExecution(
  status: IssueExecutionHistory['agentExecutions'][number]['status']
): boolean {
  return status === 'blocked' || status === 'failure';
}

export function isLatestIssueAgentExecution(
  issueExecution: Pick<IssueExecutionHistoryRecord, 'agentExecutions'>,
  agentExecutionUUID: string
): boolean {
  return issueExecution.agentExecutions.at(-1)?.uuid === agentExecutionUUID;
}

export function isLatestDispatchedIssueExecution(
  dispatchedIssue: Pick<DispatchedIssueRecord, 'latestExecutionUUID'>,
  issueExecutionUUID: string
): boolean {
  return dispatchedIssue.latestExecutionUUID === issueExecutionUUID;
}

export function compareDispatchedIssuesByLatestExecution(
  left: Pick<DispatchedIssue, 'uuid' | 'lastDispatchedAt' | 'updatedAt'>,
  right: Pick<DispatchedIssue, 'uuid' | 'lastDispatchedAt' | 'updatedAt'>
): number {
  const leftDispatchedAt = left.lastDispatchedAt
    ? Date.parse(left.lastDispatchedAt)
    : Number.NEGATIVE_INFINITY;
  const rightDispatchedAt = right.lastDispatchedAt
    ? Date.parse(right.lastDispatchedAt)
    : Number.NEGATIVE_INFINITY;

  if (leftDispatchedAt !== rightDispatchedAt) {
    return rightDispatchedAt - leftDispatchedAt;
  }

  const updatedAtDifference =
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  return updatedAtDifference || left.uuid.localeCompare(right.uuid);
}

export async function getDispatchedIssues(
  teamUUID: string
): Promise<DispatchedIssue[]> {
  const [installationInfo, issues] = await Promise.all([
    resolveCurrentInstallationInfo(),
    listDispatchedIssues(teamUUID)
  ]);

  return issues
    .map((issue) =>
      toDispatchedIssue(issue, {
        onesBaseUrl: installationInfo.ones_base_url,
        teamUUID
      })
    )
    .sort(compareDispatchedIssuesByLatestExecution);
}

export async function getDispatchedIssue(
  uuid: string,
  teamUUID: string
): Promise<DispatchedIssue> {
  const dispatchedIssue = await findDispatchedIssueByUUID(uuid, teamUUID);

  if (!dispatchedIssue) {
    throw new DispatchedIssueNotFoundError(uuid);
  }

  const installationInfo = await resolveCurrentInstallationInfo();

  return toDispatchedIssue(dispatchedIssue, {
    onesBaseUrl: installationInfo.ones_base_url,
    teamUUID
  });
}

export async function getDispatchedIssueExecutionHistories(
  dispatchedIssueUUID: string,
  teamUUID: string
): Promise<IssueExecutionHistory[]> {
  await getDispatchedIssue(dispatchedIssueUUID, teamUUID);

  return (
    await listIssueExecutionHistoriesByDispatchedIssueUUID(
      dispatchedIssueUUID,
      teamUUID
    )
  ).map(toIssueExecutionHistorySummary);
}

export async function getIssueExecutionHistory(
  uuid: string,
  teamUUID: string
): Promise<IssueExecutionHistory> {
  const issueExecutionHistory = await findIssueExecutionHistoryByUUID(
    uuid,
    teamUUID
  );

  if (!issueExecutionHistory) {
    throw new IssueExecutionHistoryNotFoundError(uuid);
  }

  return toIssueExecutionHistory(issueExecutionHistory);
}

export async function getIssueAgentExecutionHistory(
  uuid: string,
  teamUUID: string
): Promise<IssueAgentExecutionHistory> {
  const agentExecution = await findIssueAgentExecutionHistoryByUUID(
    uuid,
    teamUUID
  );

  if (!agentExecution) {
    throw new IssueAgentExecutionHistoryNotFoundError(uuid);
  }

  return toIssueAgentExecutionHistory(agentExecution);
}

export async function deleteDispatchedIssueExecutionRecords(
  uuid: string,
  teamUUID: string
): Promise<void> {
  await getDispatchedIssue(uuid, teamUUID);

  const issueExecutions =
    await listIssueExecutionHistoriesByDispatchedIssueUUID(uuid, teamUUID);

  for (const issueExecution of issueExecutions) {
    await Promise.all(
      issueExecution.agentExecutions.map((agentExecution) =>
        deleteIssueAgentExecutionHistoryByUUID(agentExecution.uuid, teamUUID)
      )
    );
    await deleteIssueExecutionHistoryByUUID(issueExecution.uuid, teamUUID);
  }

  await deleteDispatchedIssueByUUID(uuid, teamUUID);
}

export async function retryIssueAgentExecutionHistory(
  uuid: string,
  teamUUID: string
): Promise<IssueExecutionHistory['agentExecutions'][number]> {
  const agentExecution = await findIssueAgentExecutionHistoryByUUID(
    uuid,
    teamUUID
  );

  if (!agentExecution) {
    throw new IssueAgentExecutionHistoryNotFoundError(uuid);
  }

  const currentStatus =
    agentExecution.status as IssueExecutionHistory['agentExecutions'][number]['status'];

  if (!canRetryIssueAgentExecution(currentStatus)) {
    throw new IssueAgentExecutionHistoryRetryNotAllowedError(
      `Issue agent execution history "${uuid}" cannot be retried from status "${agentExecution.status}"`
    );
  }

  const issueExecution = await findIssueExecutionHistoryByUUID(
    agentExecution.issueExecutionUUID,
    teamUUID
  );

  if (!issueExecution) {
    throw new IssueExecutionHistoryNotFoundError(
      agentExecution.issueExecutionUUID
    );
  }

  if (!isLatestIssueAgentExecution(issueExecution, agentExecution.uuid)) {
    throw new IssueAgentExecutionHistoryRetryNotAllowedError(
      `Issue agent execution history "${uuid}" cannot be retried because it is not the latest attempt`
    );
  }

  const dispatchedIssue = await findDispatchedIssueByUUID(
    issueExecution.dispatchedIssueUUID,
    teamUUID
  );

  if (!dispatchedIssue) {
    throw new DispatchedIssueNotFoundError(issueExecution.dispatchedIssueUUID);
  }

  if (!isLatestDispatchedIssueExecution(dispatchedIssue, issueExecution.uuid)) {
    throw new IssueAgentExecutionHistoryRetryNotAllowedError(
      `Issue agent execution history "${uuid}" cannot be retried because it does not belong to the latest execution`
    );
  }

  const retryUUID = randomUUID();
  await createIssueAgentExecutionHistories(
    [
      {
        uuid: retryUUID,
        issueExecutionUUID: agentExecution.issueExecutionUUID,
        agentUUID: agentExecution.agentUUID,
        agentName: agentExecution.agentName,
        agentVersion: agentExecution.agentVersion,
        executorUUID: agentExecution.executorUUID,
        executorName: agentExecution.executorName,
        prompt: '',
        executePayload: {},
        executeOption: toJsonObject({
          loopContext: {
            source: 'manual',
            attemptNumber: issueExecution.agentExecutions.length + 1,
            previousAttemptUUID: agentExecution.uuid,
            previousCandidate: agentExecution.rawExecuteResult,
            deterministicValidation: {
              passed: false,
              errors: ['Manual retry requested']
            },
            aiReview: null
          }
        }),
        executeResult: {},
        rawExecuteResult: '',
        status: 'created',
        logs: '',
        executeClientUUID: null,
        executeClientName: null
      }
    ],
    teamUUID
  );

  await refreshIssueExecutionAggregate(
    agentExecution.issueExecutionUUID,
    teamUUID
  );

  const retriedAgentExecution = await findIssueAgentExecutionHistoryByUUID(
    retryUUID,
    teamUUID
  );

  if (!retriedAgentExecution) {
    throw new IssueAgentExecutionHistoryNotFoundError(retryUUID);
  }

  return toIssueAgentExecutionHistory(retriedAgentExecution);
}

async function initializeIssueExecution(
  issue: OnesIssue,
  workflowNode: ExecutableWorkflowNode,
  teamUUID: string
): Promise<void> {
  await upsertDispatchedIssue(
    {
      uuid: issue.uuid,
      displayId: issue.displayId,
      name: issue.name,
      projectUUID: issue.project.uuid,
      projectName: issue.project.name,
      issueTypeUUID: issue.issueType.uuid,
      issueTypeName: issue.issueType.name,
      statusUUID: issue.status.uuid,
      statusName: issue.status.name,
      assigneeUUID: issue.assignee.uuid,
      assigneeName: issue.assignee.name
    },
    teamUUID
  );

  const activeExecution =
    await findActiveIssueExecutionHistoryByDispatchedIssueUUID(
      issue.uuid,
      teamUUID
    );

  if (activeExecution) {
    return;
  }

  const issueExecutions =
    await listIssueExecutionHistoriesByDispatchedIssueUUID(
      issue.uuid,
      teamUUID
    );
  const latestExecution = issueExecutions[0] ?? null;

  if (
    latestExecution &&
    isBlockedOnCurrentTrigger(issue, workflowNode, latestExecution)
  ) {
    logger.warn(
      '[workflow-execution] skip issue because latest execution is blocked for current trigger',
      {
        teamUUID,
        issueUUID: issue.uuid,
        issueDisplayId: issue.displayId,
        workflowUUID: workflowNode.workflow.uuid,
        workflowNodeUUID: workflowNode.uuid,
        latestExecutionUUID: latestExecution.uuid
      }
    );
    return;
  }

  const agent = workflowNode.agents[0];

  if (!agent) {
    logger.error(
      '[workflow-execution] skip issue because matched node has no agent',
      {
        issueUUID: issue.uuid,
        workflowUUID: workflowNode.workflow.uuid,
        workflowNodeUUID: workflowNode.uuid
      }
    );
    return;
  }

  if (agent.currentVersion === null) {
    logger.error(
      '[workflow-execution] skip issue because matched node contains unpublished agent',
      {
        issueUUID: issue.uuid,
        workflowUUID: workflowNode.workflow.uuid,
        workflowNodeUUID: workflowNode.uuid,
        agentUUID: agent.uuid
      }
    );
    return;
  }

  const agentVersions = await findAgentVersions(
    [
      {
        agentUUID: agent.uuid,
        version: agent.currentVersion
      }
    ],
    teamUUID
  );
  const agentVersion = agentVersions.find(
    (v) => v.agentUUID === agent.uuid && v.version === agent.currentVersion
  );

  if (!agentVersion || !agentVersion.config) {
    logger.error(
      '[workflow-execution] skip issue because matched node contains invalid agent config',
      {
        issueUUID: issue.uuid,
        workflowUUID: workflowNode.workflow.uuid,
        workflowNodeUUID: workflowNode.uuid,
        agentUUID: agent.uuid
      }
    );
    return;
  }

  const issueExecutionUUID = randomUUID();
  const dispatchedAt = new Date();
  const previousSuccessfulExecution = workflowNode.revisionContextEnabled
    ? (issueExecutions.find(
        (execution) =>
          execution.workflowNodeUUID === workflowNode.uuid &&
          execution.status === 'success'
      ) ?? null)
    : null;
  const successfulNodeExecutions = issueExecutions.filter(
    (execution) =>
      execution.workflowNodeUUID === workflowNode.uuid &&
      execution.status === 'success'
  );
  const iteration = previousSuccessfulExecution
    ? Math.max(
        successfulNodeExecutions.length,
        ...successfulNodeExecutions.map((execution) => execution.iteration)
      ) + 1
    : 1;

  await createIssueExecutionHistory(
    {
      uuid: issueExecutionUUID,
      dispatchedIssueUUID: issue.uuid,
      workflowUUID: workflowNode.workflow.uuid,
      workflowName: workflowNode.workflow.name,
      workflowNodeUUID: workflowNode.uuid,
      workflowNodeName: workflowNode.status.name,
      iteration,
      triggerReason: previousSuccessfulExecution ? 'revision' : 'initial',
      previousExecutionUUID: previousSuccessfulExecution?.uuid ?? null,
      triggerStatusUUID: issue.status.uuid,
      triggerStatusName: issue.status.name,
      triggerAssigneeUUID: issue.assignee.uuid,
      triggerAssigneeName: issue.assignee.name,
      status: 'created',
      currentAgentUUID: ''
    },
    teamUUID
  );

  await createIssueAgentExecutionHistories(
    [
      {
        uuid: randomUUID(),
        issueExecutionUUID,
        agentUUID: agent.uuid,
        agentName: agent.name,
        agentVersion: agent.currentVersion,
        executorUUID: (agent.executor as RefObject).uuid,
        executorName: (agent.executor as RefObject).name,
        prompt: agentVersion.config?.prompt ?? '',
        executePayload: toJsonObject({}),
        executeOption: toJsonObject({}),
        executeResult: toJsonObject({}),
        rawExecuteResult: '',
        status: 'created',
        logs: '',
        executeClientUUID: null,
        executeClientName: null
      }
    ],
    teamUUID
  );

  await updateDispatchedIssueLatestExecution(
    {
      uuid: issue.uuid,
      latestExecutionUUID: issueExecutionUUID,
      latestExecutionStatus: 'created',
      lastDispatchedAt: dispatchedAt
    },
    teamUUID
  );

  logger.info('[workflow-execution] created issue execution', {
    teamUUID,
    issueUUID: issue.uuid,
    issueDisplayId: issue.displayId,
    workflowUUID: workflowNode.workflow.uuid,
    workflowNodeUUID: workflowNode.uuid,
    executorUUID: workflowNode.executor.uuid,
    agentUUID: workflowNode.agents[0].uuid,
    issueExecutionUUID
  });
}

export async function pollWorkflowIssueExecutionsOnce(
  teamUUID: string
): Promise<void> {
  const workflowNodes = await loadExecutableWorkflowNodes(teamUUID);

  if (workflowNodes.length === 0) {
    logger.info(
      '[workflow-execution] skip polling team because no executable workflow nodes found',
      {
        teamUUID
      }
    );
    return;
  }

  const workflowNodesByExecutor = new Map<string, ExecutableWorkflowNode[]>();

  for (const workflowNode of workflowNodes) {
    const currentNodes =
      workflowNodesByExecutor.get(workflowNode.executor.uuid) ?? [];
    currentNodes.push(workflowNode);
    workflowNodesByExecutor.set(workflowNode.executor.uuid, currentNodes);
  }

  logger.info('[workflow-execution] loaded executable workflow nodes', {
    teamUUID,
    workflowNodeCount: workflowNodes.length,
    executorCount: workflowNodesByExecutor.size
  });

  for (const [executorUUID, executorWorkflowNodes] of workflowNodesByExecutor) {
    const assignedIssueFilters = getAssignedIssueFilters(executorWorkflowNodes);
    const issues = await listWorkflowIssues(
      {
        teamUUID,
        userUUID: executorUUID
      },
      {
        filters: assignedIssueFilters,
        limit: ONES_ISSUE_LIMIT
      }
    );

    logger.info('[workflow-execution] polled executor issues', {
      teamUUID,
      executorUUID,
      workflowNodeCount: executorWorkflowNodes.length,
      workflowFilterCount: assignedIssueFilters.length,
      issueCount: issues.length
    });

    for (const issue of issues) {
      const matchedNodes = getMatchingWorkflowNodes(issue, workflowNodes);

      if (matchedNodes.length === 0) {
        continue;
      }

      if (matchedNodes.length > 1) {
        logger.error(
          '[workflow-execution] skip issue because multiple workflow nodes matched',
          {
            issueUUID: issue.uuid,
            executorUUID,
            workflowNodeUUIDs: matchedNodes.map((node) => node.uuid)
          }
        );
        continue;
      }

      const matchedNode = matchedNodes[0];

      if (matchedNode.executor.uuid !== executorUUID) {
        continue;
      }

      await initializeIssueExecution(issue, matchedNode, teamUUID);
    }
  }
}
