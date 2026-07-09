import {
  createEntityStore,
  type HostedEntityEntry
} from '../../lib/hosted-storage.js';
import type {
  CreateWorkflowNodeDTO,
  UpdateWorkflowDTO,
  UpdateWorkflowNodeDTO,
  WorkflowSummaryDTO
} from './dto.js';

const WORKFLOW_ENTITY_NAME = 'workflow';
const WORKFLOW_NODE_ENTITY_NAME = 'workflow_node';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';

const workflowStore = createEntityStore<StoredWorkflowEntity>(WORKFLOW_ENTITY_NAME);
const workflowNodeStore =
  createEntityStore<StoredWorkflowNodeEntity>(WORKFLOW_NODE_ENTITY_NAME);

export type WorkflowRecord = {
  uuid: string;
  name: string;
  isActive: boolean;
};

export type WorkflowNodeRecord = {
  uuid: string;
  workflowUUID: string;
  triggerType: 'issue_status' | 'manual' | 'cron';
  projectUUID: string;
  projectName: string;
  issueTypeUUID: string;
  issueTypeName: string;
  statusUUID: string | null;
  statusName: string | null;
  agentUUID: string;
  conditionExpression: string;
  conditionDescription: string;
  scheduleCron: string | null;
  scheduleTimezone: string | null;
};

interface StoredWorkflowEntity {
  team_uuid: string;
  uuid: string;
  name: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

interface StoredWorkflowNodeEntity {
  team_uuid: string;
  uuid: string;
  workflow_uuid: string;
  trigger_type: string;
  project_uuid: string;
  project_name: string;
  issue_type_uuid: string;
  issue_type_name: string;
  status_uuid: string;
  status_name: string;
  agent_uuids_text: string;
  condition_expression: string;
  condition_description: string;
  schedule_cron: string;
  schedule_timezone: string;
  created_at: number;
  updated_at: number;
}

type CreateWorkflowRecordInput = {
  uuid: string;
  name: string;
};

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getWorkflowKey(teamUUID: string, workflowUUID: string): string {
  return `workflow_${normalizeKeySegment(teamUUID)}_${normalizeKeySegment(workflowUUID)}`;
}

function getWorkflowNodeKey(teamUUID: string, workflowNodeUUID: string): string {
  return `workflow_node_${normalizeKeySegment(teamUUID)}_${normalizeKeySegment(workflowNodeUUID)}`;
}

function compactUUID(value: string): string {
  return value.replace(/-/g, '').toLowerCase();
}

function expandCompactUUID(value: string): string {
  if (!/^[0-9a-f]{32}$/i.test(value)) {
    return value;
  }

  const normalized = value.toLowerCase();
  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20)
  ].join('-');
}

function serializeAgentUUID(agentUUID: string): string {
  return compactUUID(agentUUID);
}

function parseAgentUUIDText(value: string): string {
  if (!value) {
    return '';
  }

  // Backward compatible: old data may be a JSON array or comma-separated string
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      const first = parsed.find(
        (item): item is string => typeof item === 'string' && item.length > 0
      );
      return first ?? '';
    }

    if (typeof parsed === 'string') {
      return parsed;
    }

    return '';
  } catch {
    // Comma-separated format: take the first UUID
    const first = value.split(',').map((item) => item.trim()).find(Boolean);
    return first ? expandCompactUUID(first) : '';
  }
}

function toWorkflowRecord(entry: StoredWorkflowEntity): WorkflowRecord {
  return {
    uuid: entry.uuid,
    name: entry.name,
    isActive: entry.is_active
  };
}

function toWorkflowNodeRecord(entry: StoredWorkflowNodeEntity): WorkflowNodeRecord {
  const triggerType = ['manual', 'cron', 'issue_status'].includes(entry.trigger_type)
    ? (entry.trigger_type as 'issue_status' | 'manual' | 'cron')
    : 'issue_status';

  return {
    uuid: entry.uuid,
    workflowUUID: entry.workflow_uuid,
    triggerType,
    projectUUID: entry.project_uuid,
    projectName: entry.project_name,
    issueTypeUUID: entry.issue_type_uuid,
    issueTypeName: entry.issue_type_name,
    statusUUID: entry.status_uuid || null,
    statusName: entry.status_name || null,
    agentUUID: parseAgentUUIDText(entry.agent_uuids_text),
    conditionExpression: entry.condition_expression ?? '',
    conditionDescription: entry.condition_description ?? '',
    scheduleCron: entry.schedule_cron || null,
    scheduleTimezone: entry.schedule_timezone || null
  };
}

async function listTeamWorkflowEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredWorkflowEntity>>> {
  return workflowStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listTeamWorkflowNodeEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredWorkflowNodeEntity>>> {
  return workflowNodeStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listWorkflowEntries(): Promise<
  Array<HostedEntityEntry<StoredWorkflowEntity>>
> {
  return workflowStore.getMany();
}

async function listWorkflowNodeEntries(): Promise<
  Array<HostedEntityEntry<StoredWorkflowNodeEntity>>
> {
  return workflowNodeStore.getMany();
}

async function getStoredWorkflowByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredWorkflowEntity | null> {
  const entry = await workflowStore.get(getWorkflowKey(teamUUID, uuid));
  return entry?.team_uuid === teamUUID ? entry : null;
}

async function getStoredWorkflowNodeByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredWorkflowNodeEntity | null> {
  const entry = await workflowNodeStore.get(getWorkflowNodeKey(teamUUID, uuid));
  return entry?.team_uuid === teamUUID ? entry : null;
}

export async function listWorkflows(teamUUID: string): Promise<WorkflowSummaryDTO[]> {
  const entries = await listTeamWorkflowEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at)
    .map(toWorkflowRecord);
}

export async function listWorkflowTeamUUIDs(): Promise<string[]> {
  const [workflowEntries, workflowNodeEntries] = await Promise.all([
    listWorkflowEntries(),
    listWorkflowNodeEntries()
  ]);

  return Array.from(
    new Set([
      ...workflowEntries.map((entry) => entry.value.team_uuid),
      ...workflowNodeEntries.map((entry) => entry.value.team_uuid)
    ])
  )
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export async function findWorkflowByUUID(
  uuid: string,
  teamUUID: string
): Promise<WorkflowRecord | null> {
  const record = await getStoredWorkflowByUUID(uuid, teamUUID);
  return record ? toWorkflowRecord(record) : null;
}

export async function createWorkflow(
  workflow: CreateWorkflowRecordInput,
  teamUUID: string
): Promise<WorkflowRecord> {
  const now = Date.now();

  await workflowStore.set(getWorkflowKey(teamUUID, workflow.uuid), {
    team_uuid: teamUUID,
    uuid: workflow.uuid,
    name: workflow.name,
    is_active: true,
    created_at: now,
    updated_at: now
  });

  return {
    uuid: workflow.uuid,
    name: workflow.name,
    isActive: true
  };
}

export async function updateWorkflow(
  uuid: string,
  workflow: UpdateWorkflowDTO,
  teamUUID: string
): Promise<WorkflowRecord | null> {
  const record = await getStoredWorkflowByUUID(uuid, teamUUID);

  if (!record) {
    return null;
  }

  const nextRecord: StoredWorkflowEntity = {
    ...record,
    name: workflow.name ?? record.name,
    is_active: workflow.isActive ?? record.is_active,
    updated_at: Date.now()
  };

  await workflowStore.set(getWorkflowKey(teamUUID, uuid), nextRecord);

  return toWorkflowRecord(nextRecord);
}

export async function deleteWorkflow(
  uuid: string,
  teamUUID: string
): Promise<void> {
  await workflowStore.delete(getWorkflowKey(teamUUID, uuid));
}

export async function deleteWorkflowNodesByWorkflowUUID(
  workflowUUID: string,
  teamUUID: string
): Promise<void> {
  const entries = await listTeamWorkflowNodeEntries(teamUUID);
  const targets = entries.filter((entry) => entry.value.workflow_uuid === workflowUUID);

  await Promise.all(
    targets.map((entry) =>
      workflowNodeStore.delete(getWorkflowNodeKey(teamUUID, entry.value.uuid))
    )
  );
}

export async function listWorkflowNodes(
  workflowUUID: string,
  teamUUID: string
): Promise<WorkflowNodeRecord[]> {
  const entries = await listTeamWorkflowNodeEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .filter((entry) => entry.workflow_uuid === workflowUUID)
    .sort((left, right) => left.created_at - right.created_at)
    .map(toWorkflowNodeRecord);
}

export async function listAllWorkflowNodes(
  teamUUID: string
): Promise<WorkflowNodeRecord[]> {
  const entries = await listTeamWorkflowNodeEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at)
    .map(toWorkflowNodeRecord);
}

export async function findWorkflowNodeByUUID(
  uuid: string,
  teamUUID: string
): Promise<WorkflowNodeRecord | null> {
  const record = await getStoredWorkflowNodeByUUID(uuid, teamUUID);
  return record ? toWorkflowNodeRecord(record) : null;
}

export async function createWorkflowNode(
  workflowUUID: string,
  uuid: string,
  node: CreateWorkflowNodeDTO,
  teamUUID: string
): Promise<WorkflowNodeRecord> {
  const now = Date.now();
  const record: StoredWorkflowNodeEntity = {
    team_uuid: teamUUID,
    uuid,
    workflow_uuid: workflowUUID,
    trigger_type: node.triggerType,
    project_uuid: node.project.uuid,
    project_name: node.project.name,
    issue_type_uuid: node.issueType.uuid,
    issue_type_name: node.issueType.name,
    status_uuid: node.status?.uuid ?? '',
    status_name: node.status?.name ?? '',
    agent_uuids_text: serializeAgentUUID(node.agentUUID),
    condition_expression: node.condition.expression,
    condition_description: node.condition.description,
    schedule_cron: node.schedule?.cron ?? '',
    schedule_timezone: node.schedule?.timezone ?? '',
    created_at: now,
    updated_at: now
  };

  await workflowNodeStore.set(getWorkflowNodeKey(teamUUID, uuid), record);

  return toWorkflowNodeRecord(record);
}

export async function updateWorkflowNode(
  uuid: string,
  node: UpdateWorkflowNodeDTO,
  teamUUID: string
): Promise<WorkflowNodeRecord | null> {
  const record = await getStoredWorkflowNodeByUUID(uuid, teamUUID);

  if (!record) {
    return null;
  }

  const nextRecord: StoredWorkflowNodeEntity = {
    ...record,
    project_uuid: node.project.uuid,
    project_name: node.project.name,
    issue_type_uuid: node.issueType.uuid,
    issue_type_name: node.issueType.name,
    trigger_type: node.triggerType,
    status_uuid: node.status?.uuid ?? '',
    status_name: node.status?.name ?? '',
    agent_uuids_text: serializeAgentUUID(node.agentUUID),
    condition_expression: node.condition.expression,
    condition_description: node.condition.description,
    schedule_cron: node.schedule?.cron ?? '',
    schedule_timezone: node.schedule?.timezone ?? '',
    updated_at: Date.now()
  };

  await workflowNodeStore.set(getWorkflowNodeKey(teamUUID, uuid), nextRecord);

  return toWorkflowNodeRecord(nextRecord);
}

export async function deleteWorkflowNode(
  uuid: string,
  teamUUID: string
): Promise<void> {
  await workflowNodeStore.delete(getWorkflowNodeKey(teamUUID, uuid));
}
