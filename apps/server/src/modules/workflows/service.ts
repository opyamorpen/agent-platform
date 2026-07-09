import { randomUUID } from 'node:crypto';
import type { Agent, Workflow, WorkflowNode, WorkflowSummary } from '@ones-ai-workflow/shared';
import {
  findAgentByUUID,
  findAgentsByUUIDs,
  findDispatchAgentsByUUIDs
} from '../agents/repository.js';
import type {
  CreateWorkflowDTO,
  CreateWorkflowNodeDTO,
  UpdateWorkflowDTO,
  UpdateWorkflowNodeDTO
} from './dto.js';
import {
  createWorkflow as createWorkflowRecord,
  createWorkflowNode as createWorkflowNodeRecord,
  deleteWorkflow as deleteWorkflowRecord,
  deleteWorkflowNode as deleteWorkflowNodeRecord,
  findWorkflowByUUID,
  findWorkflowNodeByUUID,
  listWorkflowNodes,
  listWorkflows,
  type WorkflowNodeRecord,
  updateWorkflow as updateWorkflowRecord,
  updateWorkflowNode as updateWorkflowNodeRecord
} from './repository.js';

export class WorkflowNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Workflow not found: ${uuid}`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class WorkflowDeletionBlockedError extends Error {
  constructor(uuid: string) {
    super(`Workflow cannot be deleted while it still has execution nodes: ${uuid}`);
    this.name = 'WorkflowDeletionBlockedError';
  }
}

export class WorkflowNodeNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Workflow node not found: ${uuid}`);
    this.name = 'WorkflowNodeNotFoundError';
  }
}

export class WorkflowNodeExecutorInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowNodeExecutorInvalidError';
  }
}

export function validateWorkflowNodeExecutorBindings(
  agents: Array<{
    uuid: string;
    name: string;
    executor: { uuid: string; name: string } | null;
  }>
): void {
  const agentsWithoutExecutor = agents.filter((agent) => !agent.executor);

  if (agentsWithoutExecutor.length > 0) {
    throw new WorkflowNodeExecutorInvalidError(
      `Workflow node agents must have executor: ${agentsWithoutExecutor
        .map((agent) => agent.name)
        .join(', ')}`
    );
  }

  const executorUUIDs = new Set(
    agents.flatMap((agent) => (agent.executor ? [agent.executor.uuid] : []))
  );

  if (executorUUIDs.size > 1) {
    throw new WorkflowNodeExecutorInvalidError(
      'Workflow node agents must use the same executor'
    );
  }
}

export async function getWorkflowSummaries(teamUUID: string): Promise<WorkflowSummary[]> {
  return listWorkflows(teamUUID);
}

export async function getWorkflow(uuid: string, teamUUID: string): Promise<Workflow> {
  const workflow = await findWorkflowByUUID(uuid, teamUUID);

  if (!workflow) {
    throw new WorkflowNotFoundError(uuid);
  }

  return {
    ...workflow,
    nodes: await getWorkflowNodes(uuid, teamUUID)
  };
}

export async function createWorkflow(
  workflow: CreateWorkflowDTO,
  teamUUID: string
): Promise<WorkflowSummary> {
  const workflowUUID = randomUUID();
  return createWorkflowRecord(
    {
      uuid: workflowUUID,
      name: workflow.name
    },
    teamUUID
  );
}

export async function updateWorkflow(
  uuid: string,
  workflow: UpdateWorkflowDTO,
  teamUUID: string
): Promise<WorkflowSummary> {
  const updatedWorkflow = await updateWorkflowRecord(uuid, workflow, teamUUID);

  if (!updatedWorkflow) {
    throw new WorkflowNotFoundError(uuid);
  }

  return updatedWorkflow;
}

export async function removeWorkflow(uuid: string, teamUUID: string): Promise<void> {
  const workflow = await findWorkflowByUUID(uuid, teamUUID);

  if (!workflow) {
    throw new WorkflowNotFoundError(uuid);
  }

  const workflowNodes = await listWorkflowNodes(uuid, teamUUID);

  if (workflowNodes.length > 0) {
    throw new WorkflowDeletionBlockedError(uuid);
  }

  await deleteWorkflowRecord(uuid, teamUUID);
}

export async function getWorkflowNodes(
  workflowUUID: string,
  teamUUID: string
): Promise<WorkflowNode[]> {
  const workflow = await findWorkflowByUUID(workflowUUID, teamUUID);

  if (!workflow) {
    throw new WorkflowNotFoundError(workflowUUID);
  }

  const nodes = await listWorkflowNodes(workflowUUID, teamUUID);
  return mapWorkflowNodes(nodes, teamUUID);
}

export async function createWorkflowNode(
  workflowUUID: string,
  node: CreateWorkflowNodeDTO,
  teamUUID: string
): Promise<WorkflowNode> {
  const workflow = await findWorkflowByUUID(workflowUUID, teamUUID);

  if (!workflow) {
    throw new WorkflowNotFoundError(workflowUUID);
  }

  await assertWorkflowNodeExecutor(node.agentUUID, teamUUID);

  const createdNode = await createWorkflowNodeRecord(
    workflowUUID,
    randomUUID(),
    node,
    teamUUID
  );

  return mapWorkflowNode(createdNode, teamUUID);
}

export async function updateWorkflowNode(
  uuid: string,
  node: UpdateWorkflowNodeDTO,
  teamUUID: string
): Promise<WorkflowNode> {
  await assertWorkflowNodeExecutor(node.agentUUID, teamUUID);

  const updatedNode = await updateWorkflowNodeRecord(uuid, node, teamUUID);

  if (!updatedNode) {
    throw new WorkflowNodeNotFoundError(uuid);
  }

  return mapWorkflowNode(updatedNode, teamUUID);
}

export async function removeWorkflowNode(uuid: string, teamUUID: string): Promise<void> {
  const node = await findWorkflowNodeByUUID(uuid, teamUUID);

  if (!node) {
    throw new WorkflowNodeNotFoundError(uuid);
  }

  await deleteWorkflowNodeRecord(uuid, teamUUID);
}

async function mapWorkflowNodes(
  nodes: WorkflowNodeRecord[],
  teamUUID: string
): Promise<WorkflowNode[]> {
  const agentUUIDs = Array.from(
    new Set(nodes.map((node) => node.agentUUID).filter(Boolean))
  );
  const agents = await findAgentsByUUIDs(agentUUIDs, teamUUID);
  const agentMap = new Map<string, Agent>(
    agents.map((agent: Agent) => [agent.uuid, agent])
  );

  return nodes.map((node) => toWorkflowNode(node, agentMap));
}

async function mapWorkflowNode(
  node: WorkflowNodeRecord,
  teamUUID: string
): Promise<WorkflowNode> {
  const agentUUID = node.agentUUID;

  if (!agentUUID) {
    throw new WorkflowNodeExecutorInvalidError(
      `Workflow node ${node.uuid} has no agent`
    );
  }

  const agent = await findAgentByUUID(agentUUID, teamUUID);

  if (!agent) {
    throw new WorkflowNodeExecutorInvalidError(
      `Workflow node references missing agent: ${agentUUID}`
    );
  }

  return toWorkflowNode(node, new Map([[agent.uuid, agent]]));
}

function toWorkflowNode(
  node: WorkflowNodeRecord,
  agentMap: Map<string, Agent>
): WorkflowNode {
  const agentUUID = node.agentUUID;
  const agent = agentUUID ? agentMap.get(agentUUID) : null;

  if (!agent) {
    throw new WorkflowNodeExecutorInvalidError(
      `Workflow node ${node.uuid} references missing agent: ${agentUUID}`
    );
  }

  return {
    uuid: node.uuid,
    triggerType: node.triggerType,
    project: {
      uuid: node.projectUUID,
      name: node.projectName
    },
    issueType: {
      uuid: node.issueTypeUUID,
      name: node.issueTypeName
    },
    status:
      node.statusUUID && node.statusName
        ? {
            uuid: node.statusUUID,
            name: node.statusName
          }
        : null,
    condition: {
      expression: node.conditionExpression,
      description: node.conditionDescription
    },
    schedule:
      node.scheduleCron && node.scheduleTimezone
        ? {
            cron: node.scheduleCron,
            timezone: node.scheduleTimezone
          }
        : null,
    agent
  };
}

async function assertWorkflowNodeExecutor(
  agentUUID: string,
  teamUUID: string
): Promise<void> {
  const agents = await findDispatchAgentsByUUIDs([agentUUID], teamUUID);
  const agent = agents.find((a) => a.uuid === agentUUID);

  if (!agent) {
    throw new WorkflowNodeExecutorInvalidError(
      `Workflow node references missing agent: ${agentUUID}`
    );
  }

  validateWorkflowNodeExecutorBindings([agent]);
}
