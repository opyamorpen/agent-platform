import {
  buildHostedObjectKey,
  createEntityStore,
  deleteObject,
  readObjectJson,
  readObjectText,
  type HostedEntityEntry,
  uploadObjectBuffer,
  uploadObjectJson
} from '../../lib/hosted-storage.js';

const AGENT_CLIENT_ENTITY_NAME = 'agent_client';
const DISPATCHED_ISSUE_ENTITY_NAME = 'dispatched_issue';
const ISSUE_EXECUTION_HISTORY_ENTITY_NAME = 'issue_execution';
const ISSUE_AGENT_EXECUTION_HISTORY_ENTITY_NAME = 'issue_agent_execution';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const DISPATCHED_ISSUE_UUID_INDEX_NAME = 'idx_dispatched_issue_uuid';
const ISSUE_EXECUTION_UUID_INDEX_NAME = 'idx_issue_execution_uuid';

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };
export type JsonObject = Record<string, JsonValue>;

const agentClientStore = createEntityStore<StoredAgentClientEntity>(
  AGENT_CLIENT_ENTITY_NAME
);
const dispatchedIssueStore = createEntityStore<StoredDispatchedIssueEntity>(
  DISPATCHED_ISSUE_ENTITY_NAME
);
const issueExecutionHistoryStore =
  createEntityStore<StoredIssueExecutionHistoryEntity>(
    ISSUE_EXECUTION_HISTORY_ENTITY_NAME
  );
const issueAgentExecutionHistoryStore =
  createEntityStore<StoredIssueAgentExecutionHistoryEntity>(
    ISSUE_AGENT_EXECUTION_HISTORY_ENTITY_NAME
  );

export interface AgentClientRecord {
  uuid: string;
  name: string;
  status: string;
  lastExchangeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DispatchedIssueRecord {
  uuid: string;
  displayId: string;
  name: string;
  projectUUID: string;
  projectName: string;
  issueTypeUUID: string;
  issueTypeName: string;
  statusUUID: string;
  statusName: string;
  assigneeUUID: string;
  assigneeName: string;
  latestExecutionUUID: string | null;
  latestExecutionStatus: string | null;
  lastDispatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueAgentExecutionHistoryRecord {
  uuid: string;
  issueExecutionUUID: string;
  agentUUID: string;
  agentName: string;
  agentVersion: number;
  executorUUID: string;
  executorName: string;
  prompt: string;
  executePayload: JsonValue;
  executeOption: JsonValue;
  executeResult: JsonValue;
  rawExecuteResult: string;
  status: string;
  logs: string;
  usageInputTokens: number | null;
  usageOutputTokens: number | null;
  executeClientUUID: string | null;
  executeClientName: string | null;
  queuedAt: Date | null;
  lastReportedAt: Date | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface IssueExecutionHistoryRecord {
  uuid: string;
  dispatchedIssueUUID: string;
  workflowUUID: string;
  workflowName: string;
  workflowNodeUUID: string;
  workflowNodeName: string;
  iteration: number;
  triggerReason: 'initial' | 'revision';
  previousExecutionUUID: string | null;
  triggerStatusUUID: string;
  triggerStatusName: string;
  triggerAssigneeUUID: string;
  triggerAssigneeName: string;
  status: string;
  blockReason: string | null;
  currentAgentUUID: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  agentExecutions: IssueAgentExecutionHistoryRecord[];
}

export interface IssueAgentExecutionHistoryWithExecutionRecord extends IssueAgentExecutionHistoryRecord {
  issueExecution: Omit<IssueExecutionHistoryRecord, 'agentExecutions'>;
}

export interface AgentVersionExecutionAggregate {
  totalSamples: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  retryCount: number;
  totalTokens: number | null;
  averageAttempts: number;
}

export interface UpsertDispatchedIssueInput {
  uuid: string;
  displayId: string;
  name: string;
  projectUUID: string;
  projectName: string;
  issueTypeUUID: string;
  issueTypeName: string;
  statusUUID: string;
  statusName: string;
  assigneeUUID: string;
  assigneeName: string;
}

export interface CreateIssueExecutionHistoryInput {
  uuid: string;
  dispatchedIssueUUID: string;
  workflowUUID: string;
  workflowName: string;
  workflowNodeUUID: string;
  workflowNodeName: string;
  iteration: number;
  triggerReason: 'initial' | 'revision';
  previousExecutionUUID: string | null;
  triggerStatusUUID: string;
  triggerStatusName: string;
  triggerAssigneeUUID: string;
  triggerAssigneeName: string;
  status: string;
  currentAgentUUID: string;
}

export interface CreateIssueAgentExecutionHistoryInput {
  uuid: string;
  issueExecutionUUID: string;
  agentUUID: string;
  agentName: string;
  agentVersion: number;
  executorUUID: string;
  executorName: string;
  prompt: string;
  executePayload: JsonObject;
  executeOption: JsonObject;
  executeResult: JsonObject;
  rawExecuteResult: string;
  status: string;
  logs: string;
  executeClientUUID: string | null;
  executeClientName: string | null;
}

interface StoredAgentClientEntity {
  uuid: string;
  name: string;
  status: string;
  last_exchange_at: number;
  created_at: number;
  updated_at: number;
}

interface StoredDispatchedIssueEntity {
  team_uuid: string;
  uuid: string;
  display_id: string;
  name: string;
  project_uuid: string;
  project_name: string;
  issue_type_uuid: string;
  issue_type_name: string;
  status_uuid: string;
  status_name: string;
  assignee_uuid: string;
  assignee_name: string;
  latest_execution_uuid: string;
  latest_execution_status: string;
  last_dispatched_at: number;
  created_at: number;
  updated_at: number;
}

interface StoredIssueExecutionHistoryEntity {
  team_uuid: string;
  uuid: string;
  dispatched_issue_uuid: string;
  workflow_uuid: string;
  workflow_name: string;
  workflow_node_uuid: string;
  workflow_node_name: string;
  iteration: number;
  trigger_reason: string;
  previous_execution_uuid: string;
  trigger_status_uuid: string;
  trigger_status_name: string;
  trigger_assignee_uuid: string;
  trigger_assignee_name: string;
  status: string;
  block_reason: string;
  current_agent_uuid: string;
  created_at: number;
  started_at: number;
  finished_at: number;
  updated_at: number;
}

interface StoredIssueAgentExecutionHistoryEntity {
  team_uuid: string;
  uuid: string;
  issue_execution_uuid: string;
  agent_uuid: string;
  agent_name: string;
  agent_version: number;
  executor_uuid: string;
  executor_name: string;
  prompt_object_key: string;
  execute_payload_object_key: string;
  execute_option_object_key: string;
  execute_result_object_key: string;
  logs_object_key: string;
  status: string;
  usage_input_tokens: number | null;
  usage_output_tokens: number | null;
  execute_client_uuid: string;
  execute_client_name: string;
  queued_at: number;
  last_reported_at: number;
  created_at: number;
  started_at: number;
  finished_at: number;
  updated_at: number;
}

function normalizeKeySegment(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizeOptionalString(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

function normalizeOptionalNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toTimestamp(value: Date | null | undefined): number {
  return value instanceof Date ? value.getTime() : 0;
}

function fromTimestamp(value: number): Date | null {
  return value > 0 ? new Date(value) : null;
}

function getAgentClientKey(uuid: string): string {
  return `agent_client_${normalizeKeySegment(uuid)}`;
}

function getDispatchedIssueKey(teamUUID: string, uuid: string): string {
  return `dispatched_issue_${normalizeKeySegment(teamUUID)}_${normalizeKeySegment(uuid)}`;
}

function getIssueExecutionHistoryKey(teamUUID: string, uuid: string): string {
  return `issue_execution_${normalizeKeySegment(teamUUID)}_${normalizeKeySegment(uuid)}`;
}

function getIssueAgentExecutionHistoryKey(
  teamUUID: string,
  uuid: string
): string {
  return `issue_agent_execution_${normalizeKeySegment(teamUUID)}_${normalizeKeySegment(uuid)}`;
}

function getIssueAgentExecutionObjectPrefix(
  teamUUID: string,
  uuid: string
): string {
  return buildHostedObjectKey('issue-agent-execution', teamUUID, uuid);
}

function getPromptObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    getIssueAgentExecutionObjectPrefix(teamUUID, uuid),
    'prompt.txt'
  );
}

function getExecutePayloadObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    getIssueAgentExecutionObjectPrefix(teamUUID, uuid),
    'execute-payload.json'
  );
}

function getExecuteOptionObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    getIssueAgentExecutionObjectPrefix(teamUUID, uuid),
    'execute-option.json'
  );
}

function getExecuteResultObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    getIssueAgentExecutionObjectPrefix(teamUUID, uuid),
    'execute-result.json'
  );
}

function getRawExecuteResultObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    getIssueAgentExecutionObjectPrefix(teamUUID, uuid),
    'raw-execute-result.txt'
  );
}

function getLogsObjectKey(teamUUID: string, uuid: string): string {
  return buildHostedObjectKey(
    getIssueAgentExecutionObjectPrefix(teamUUID, uuid),
    'logs.txt'
  );
}

async function uploadTextObject(key: string, content: string): Promise<void> {
  await uploadObjectBuffer(
    key,
    Buffer.from(content, 'utf8'),
    'text/plain; charset=utf-8'
  );
}

async function readJsonObjectOrDefault(
  key: string
): Promise<Record<string, unknown>> {
  return (await readObjectJson<Record<string, unknown>>(key)) ?? {};
}

async function readTextObjectOrDefault(key: string): Promise<string> {
  return (await readObjectText(key)) ?? '';
}

function isHostedObjectNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'ObjectKeyNotfound' || code === 'ObjectNotFound';
}

async function readRawExecuteResultObjectOrDefault(
  key: string
): Promise<string> {
  try {
    return await readTextObjectOrDefault(key);
  } catch (error) {
    if (isHostedObjectNotFoundError(error)) {
      return '';
    }

    throw error;
  }
}

async function listAgentClientEntries(): Promise<
  Array<HostedEntityEntry<StoredAgentClientEntity>>
> {
  return agentClientStore.getMany();
}

async function listTeamDispatchedIssueEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredDispatchedIssueEntity>>> {
  return dispatchedIssueStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listTeamIssueExecutionHistoryEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredIssueExecutionHistoryEntity>>> {
  return issueExecutionHistoryStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listIssueExecutionEntriesByDispatchedIssueUUID(
  dispatchedIssueUUID: string,
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredIssueExecutionHistoryEntity>>> {
  return issueExecutionHistoryStore
    .queryByIndexEqualTo(
      DISPATCHED_ISSUE_UUID_INDEX_NAME,
      'dispatched_issue_uuid',
      dispatchedIssueUUID
    )
    .then((entries) =>
      entries.filter((entry) => entry.value.team_uuid === teamUUID)
    );
}

async function listTeamIssueAgentExecutionHistoryEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredIssueAgentExecutionHistoryEntity>>> {
  return issueAgentExecutionHistoryStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listIssueAgentExecutionEntriesByIssueExecutionUUID(
  issueExecutionUUID: string,
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredIssueAgentExecutionHistoryEntity>>> {
  return issueAgentExecutionHistoryStore
    .queryByIndexEqualTo(
      ISSUE_EXECUTION_UUID_INDEX_NAME,
      'issue_execution_uuid',
      issueExecutionUUID
    )
    .then((entries) =>
      entries.filter((entry) => entry.value.team_uuid === teamUUID)
    );
}

function toAgentClientRecord(
  entry: StoredAgentClientEntity
): AgentClientRecord {
  return {
    uuid: entry.uuid,
    name: entry.name,
    status: entry.status,
    lastExchangeAt: fromTimestamp(entry.last_exchange_at),
    createdAt: new Date(entry.created_at),
    updatedAt: new Date(entry.updated_at)
  };
}

function toDispatchedIssueRecord(
  entry: StoredDispatchedIssueEntity
): DispatchedIssueRecord {
  return {
    uuid: entry.uuid,
    displayId: entry.display_id,
    name: entry.name,
    projectUUID: entry.project_uuid,
    projectName: entry.project_name,
    issueTypeUUID: entry.issue_type_uuid,
    issueTypeName: entry.issue_type_name,
    statusUUID: entry.status_uuid,
    statusName: entry.status_name,
    assigneeUUID: entry.assignee_uuid,
    assigneeName: entry.assignee_name,
    latestExecutionUUID: entry.latest_execution_uuid || null,
    latestExecutionStatus: entry.latest_execution_status || null,
    lastDispatchedAt: fromTimestamp(entry.last_dispatched_at),
    createdAt: new Date(entry.created_at),
    updatedAt: new Date(entry.updated_at)
  };
}

function toIssueExecutionHistoryBaseRecord(
  entry: StoredIssueExecutionHistoryEntity
): Omit<IssueExecutionHistoryRecord, 'agentExecutions'> {
  return {
    uuid: entry.uuid,
    dispatchedIssueUUID: entry.dispatched_issue_uuid,
    workflowUUID: entry.workflow_uuid,
    workflowName: entry.workflow_name,
    workflowNodeUUID: entry.workflow_node_uuid,
    workflowNodeName: entry.workflow_node_name,
    iteration:
      typeof entry.iteration === 'number' && entry.iteration > 0
        ? entry.iteration
        : 1,
    triggerReason: entry.trigger_reason === 'revision' ? 'revision' : 'initial',
    previousExecutionUUID: entry.previous_execution_uuid || null,
    triggerStatusUUID: entry.trigger_status_uuid || '',
    triggerStatusName: entry.trigger_status_name || '',
    triggerAssigneeUUID: entry.trigger_assignee_uuid || '',
    triggerAssigneeName: entry.trigger_assignee_name || '',
    status: entry.status,
    blockReason: entry.block_reason || null,
    currentAgentUUID: entry.current_agent_uuid,
    createdAt: new Date(entry.created_at),
    startedAt: fromTimestamp(entry.started_at),
    finishedAt: fromTimestamp(entry.finished_at)
  };
}

async function toIssueAgentExecutionHistoryRecord(
  entry: StoredIssueAgentExecutionHistoryEntity
): Promise<IssueAgentExecutionHistoryRecord> {
  const rawExecuteResultObjectKey = getRawExecuteResultObjectKey(
    entry.team_uuid,
    entry.uuid
  );
  const [
    prompt,
    executePayload,
    executeOption,
    executeResult,
    rawExecuteResult,
    logs
  ] = await Promise.all([
    readTextObjectOrDefault(entry.prompt_object_key),
    readJsonObjectOrDefault(entry.execute_payload_object_key),
    readJsonObjectOrDefault(entry.execute_option_object_key),
    readJsonObjectOrDefault(entry.execute_result_object_key),
    readRawExecuteResultObjectOrDefault(rawExecuteResultObjectKey),
    readTextObjectOrDefault(entry.logs_object_key)
  ]);

  return {
    uuid: entry.uuid,
    issueExecutionUUID: entry.issue_execution_uuid,
    agentUUID: entry.agent_uuid,
    agentName: entry.agent_name,
    agentVersion: entry.agent_version,
    executorUUID: entry.executor_uuid,
    executorName: entry.executor_name,
    prompt,
    executePayload: executePayload as JsonValue,
    executeOption: executeOption as JsonValue,
    executeResult: executeResult as JsonValue,
    rawExecuteResult,
    status: entry.status,
    logs,
    usageInputTokens: normalizeOptionalNumber(entry.usage_input_tokens),
    usageOutputTokens: normalizeOptionalNumber(entry.usage_output_tokens),
    executeClientUUID: entry.execute_client_uuid || null,
    executeClientName: entry.execute_client_name || null,
    queuedAt: fromTimestamp(entry.queued_at),
    lastReportedAt: fromTimestamp(entry.last_reported_at),
    createdAt: new Date(entry.created_at),
    startedAt: fromTimestamp(entry.started_at),
    finishedAt: fromTimestamp(entry.finished_at)
  };
}

async function materializeIssueExecutionHistoryRecord(
  entry: StoredIssueExecutionHistoryEntity,
  teamUUID: string
): Promise<IssueExecutionHistoryRecord> {
  const agentEntries = await listIssueAgentExecutionEntriesByIssueExecutionUUID(
    entry.uuid,
    teamUUID
  );
  const sortedAgentEntries = agentEntries
    .map((agentEntry) => agentEntry.value)
    .sort((left, right) => left.created_at - right.created_at);
  const agentExecutions = await Promise.all(
    sortedAgentEntries.map((agentEntry) =>
      toIssueAgentExecutionHistoryRecord(agentEntry)
    )
  );

  return {
    ...toIssueExecutionHistoryBaseRecord(entry),
    agentExecutions
  };
}

async function getStoredAgentClientByUUID(
  uuid: string
): Promise<StoredAgentClientEntity | null> {
  return (await agentClientStore.get(getAgentClientKey(uuid))) ?? null;
}

async function getStoredDispatchedIssueByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredDispatchedIssueEntity | null> {
  const entry = await dispatchedIssueStore.get(
    getDispatchedIssueKey(teamUUID, uuid)
  );
  return entry?.team_uuid === teamUUID ? entry : null;
}

async function getStoredIssueExecutionHistoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredIssueExecutionHistoryEntity | null> {
  const entry = await issueExecutionHistoryStore.get(
    getIssueExecutionHistoryKey(teamUUID, uuid)
  );
  return entry?.team_uuid === teamUUID ? entry : null;
}

async function getStoredIssueAgentExecutionHistoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredIssueAgentExecutionHistoryEntity | null> {
  const entry = await issueAgentExecutionHistoryStore.get(
    getIssueAgentExecutionHistoryKey(teamUUID, uuid)
  );
  return entry?.team_uuid === teamUUID ? entry : null;
}

async function persistAgentExecutionObjects(
  teamUUID: string,
  uuid: string,
  input: {
    prompt: string;
    executePayload: JsonObject;
    executeOption: JsonObject;
    executeResult: JsonObject;
    rawExecuteResult: string;
    logs: string;
  }
): Promise<StoredIssueAgentExecutionHistoryEntity> {
  const promptObjectKey = getPromptObjectKey(teamUUID, uuid);
  const executePayloadObjectKey = getExecutePayloadObjectKey(teamUUID, uuid);
  const executeOptionObjectKey = getExecuteOptionObjectKey(teamUUID, uuid);
  const executeResultObjectKey = getExecuteResultObjectKey(teamUUID, uuid);
  const rawExecuteResultObjectKey = getRawExecuteResultObjectKey(
    teamUUID,
    uuid
  );
  const logsObjectKey = getLogsObjectKey(teamUUID, uuid);

  await Promise.all([
    uploadTextObject(promptObjectKey, input.prompt),
    uploadObjectJson(executePayloadObjectKey, input.executePayload),
    uploadObjectJson(executeOptionObjectKey, input.executeOption),
    uploadObjectJson(executeResultObjectKey, input.executeResult),
    uploadTextObject(rawExecuteResultObjectKey, input.rawExecuteResult),
    uploadTextObject(logsObjectKey, input.logs)
  ]);

  return {
    team_uuid: teamUUID,
    uuid,
    issue_execution_uuid: '',
    agent_uuid: '',
    agent_name: '',
    agent_version: 0,
    executor_uuid: '',
    executor_name: '',
    prompt_object_key: promptObjectKey,
    execute_payload_object_key: executePayloadObjectKey,
    execute_option_object_key: executeOptionObjectKey,
    execute_result_object_key: executeResultObjectKey,
    logs_object_key: logsObjectKey,
    status: '',
    usage_input_tokens: 0,
    usage_output_tokens: 0,
    execute_client_uuid: '',
    execute_client_name: '',
    queued_at: 0,
    last_reported_at: 0,
    created_at: 0,
    started_at: 0,
    finished_at: 0,
    updated_at: 0
  };
}

export async function upsertDispatchedIssue(
  input: UpsertDispatchedIssueInput,
  teamUUID: string
) {
  const now = Date.now();
  const existing = await getStoredDispatchedIssueByUUID(input.uuid, teamUUID);

  const nextRecord: StoredDispatchedIssueEntity = {
    team_uuid: teamUUID,
    uuid: input.uuid,
    display_id: input.displayId,
    name: input.name,
    project_uuid: input.projectUUID,
    project_name: input.projectName,
    issue_type_uuid: input.issueTypeUUID,
    issue_type_name: input.issueTypeName,
    status_uuid: input.statusUUID,
    status_name: input.statusName,
    assignee_uuid: input.assigneeUUID,
    assignee_name: input.assigneeName,
    latest_execution_uuid: existing?.latest_execution_uuid ?? '',
    latest_execution_status: existing?.latest_execution_status ?? '',
    last_dispatched_at: existing?.last_dispatched_at ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: now
  };

  await dispatchedIssueStore.set(
    getDispatchedIssueKey(teamUUID, input.uuid),
    nextRecord
  );
  return toDispatchedIssueRecord(nextRecord);
}

export async function listDispatchedIssues(
  teamUUID: string
): Promise<DispatchedIssueRecord[]> {
  const entries = await listTeamDispatchedIssueEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .sort((left, right) =>
      right.updated_at !== left.updated_at
        ? right.updated_at - left.updated_at
        : right.created_at - left.created_at
    )
    .map(toDispatchedIssueRecord);
}

export async function findDispatchedIssueByUUID(
  uuid: string,
  teamUUID: string
): Promise<DispatchedIssueRecord | null> {
  const record = await getStoredDispatchedIssueByUUID(uuid, teamUUID);
  return record ? toDispatchedIssueRecord(record) : null;
}

export async function deleteDispatchedIssueByUUID(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const record = await getStoredDispatchedIssueByUUID(uuid, teamUUID);

  if (!record) {
    return;
  }

  await dispatchedIssueStore.delete(getDispatchedIssueKey(teamUUID, uuid));
}

export async function findActiveIssueExecutionHistoryByDispatchedIssueUUID(
  dispatchedIssueUUID: string,
  teamUUID: string
) {
  const entries = await listIssueExecutionEntriesByDispatchedIssueUUID(
    dispatchedIssueUUID,
    teamUUID
  );
  const record = entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at)
    .find(
      (entry) => entry.status === 'created' || entry.status === 'executing'
    );

  return record ? { uuid: record.uuid } : null;
}

export async function createIssueExecutionHistory(
  input: CreateIssueExecutionHistoryInput,
  teamUUID: string
) {
  const now = Date.now();

  await issueExecutionHistoryStore.set(
    getIssueExecutionHistoryKey(teamUUID, input.uuid),
    {
      team_uuid: teamUUID,
      uuid: input.uuid,
      dispatched_issue_uuid: input.dispatchedIssueUUID,
      workflow_uuid: input.workflowUUID,
      workflow_name: input.workflowName,
      workflow_node_uuid: input.workflowNodeUUID,
      workflow_node_name: input.workflowNodeName,
      iteration: input.iteration,
      trigger_reason: input.triggerReason,
      previous_execution_uuid: normalizeOptionalString(
        input.previousExecutionUUID
      ),
      trigger_status_uuid: input.triggerStatusUUID,
      trigger_status_name: input.triggerStatusName,
      trigger_assignee_uuid: input.triggerAssigneeUUID,
      trigger_assignee_name: input.triggerAssigneeName,
      status: input.status,
      block_reason: '',
      current_agent_uuid: input.currentAgentUUID,
      created_at: now,
      started_at: 0,
      finished_at: 0,
      updated_at: now
    }
  );
}

export async function listIssueExecutionHistoriesByDispatchedIssueUUID(
  dispatchedIssueUUID: string,
  teamUUID: string
): Promise<IssueExecutionHistoryRecord[]> {
  const entries = await listIssueExecutionEntriesByDispatchedIssueUUID(
    dispatchedIssueUUID,
    teamUUID
  );
  const sortedEntries = entries
    .map((entry) => entry.value)
    .sort((left, right) => right.created_at - left.created_at);

  return Promise.all(
    sortedEntries.map((entry) =>
      materializeIssueExecutionHistoryRecord(entry, teamUUID)
    )
  );
}

export async function findIssueExecutionHistoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<IssueExecutionHistoryRecord | null> {
  const record = await getStoredIssueExecutionHistoryByUUID(uuid, teamUUID);

  if (!record) {
    return null;
  }

  return materializeIssueExecutionHistoryRecord(record, teamUUID);
}

export async function updateDispatchedIssueLatestExecution(
  input: {
    uuid: string;
    latestExecutionUUID?: string | null;
    latestExecutionStatus: string;
    lastDispatchedAt?: Date | null;
  },
  teamUUID: string
) {
  const record = await getStoredDispatchedIssueByUUID(input.uuid, teamUUID);

  if (!record) {
    throw new Error(`Dispatched issue not found in storage: ${input.uuid}`);
  }

  const nextRecord: StoredDispatchedIssueEntity = {
    ...record,
    latest_execution_uuid:
      input.latestExecutionUUID !== undefined
        ? normalizeOptionalString(input.latestExecutionUUID)
        : record.latest_execution_uuid,
    latest_execution_status: input.latestExecutionStatus,
    last_dispatched_at:
      input.lastDispatchedAt !== undefined
        ? toTimestamp(input.lastDispatchedAt)
        : record.last_dispatched_at,
    updated_at: Date.now()
  };

  await dispatchedIssueStore.set(
    getDispatchedIssueKey(teamUUID, input.uuid),
    nextRecord
  );
  return toDispatchedIssueRecord(nextRecord);
}

export async function createIssueAgentExecutionHistories(
  inputs: CreateIssueAgentExecutionHistoryInput[],
  teamUUID: string
) {
  if (inputs.length === 0) {
    return;
  }

  const baseNow = Date.now();

  await Promise.all(
    inputs.map(async (input, index) => {
      const objectKeys = await persistAgentExecutionObjects(
        teamUUID,
        input.uuid,
        {
          prompt: input.prompt,
          executePayload: input.executePayload,
          executeOption: input.executeOption,
          executeResult: input.executeResult,
          rawExecuteResult: input.rawExecuteResult,
          logs: input.logs
        }
      );
      const createdAt = baseNow + index;

      await issueAgentExecutionHistoryStore.set(
        getIssueAgentExecutionHistoryKey(teamUUID, input.uuid),
        {
          ...objectKeys,
          team_uuid: teamUUID,
          uuid: input.uuid,
          issue_execution_uuid: input.issueExecutionUUID,
          agent_uuid: input.agentUUID,
          agent_name: input.agentName,
          agent_version: input.agentVersion,
          executor_uuid: input.executorUUID,
          executor_name: input.executorName,
          status: input.status,
          usage_input_tokens: 0,
          usage_output_tokens: 0,
          execute_client_uuid: normalizeOptionalString(input.executeClientUUID),
          execute_client_name: normalizeOptionalString(input.executeClientName),
          queued_at: 0,
          last_reported_at: 0,
          created_at: createdAt,
          started_at: 0,
          finished_at: 0,
          updated_at: createdAt
        }
      );
    })
  );
}

export async function upsertAgentClient(input: {
  uuid: string;
  name: string;
  status: string;
  lastExchangeAt: Date;
}) {
  const now = Date.now();
  const existing = await getStoredAgentClientByUUID(input.uuid);
  const nextRecord: StoredAgentClientEntity = {
    uuid: input.uuid,
    name: input.name,
    status: input.status,
    last_exchange_at: input.lastExchangeAt.getTime(),
    created_at: existing?.created_at ?? now,
    updated_at: now
  };

  await agentClientStore.set(getAgentClientKey(input.uuid), nextRecord);
  return toAgentClientRecord(nextRecord);
}

export async function listAgentClients(): Promise<AgentClientRecord[]> {
  const entries = await listAgentClientEntries();

  return entries
    .map((entry) => entry.value)
    .sort((left, right) =>
      right.last_exchange_at !== left.last_exchange_at
        ? right.last_exchange_at - left.last_exchange_at
        : right.updated_at - left.updated_at
    )
    .map(toAgentClientRecord);
}

export async function findIssueAgentExecutionHistoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<IssueAgentExecutionHistoryWithExecutionRecord | null> {
  const record = await getStoredIssueAgentExecutionHistoryByUUID(
    uuid,
    teamUUID
  );

  if (!record) {
    return null;
  }

  const issueExecution = await getStoredIssueExecutionHistoryByUUID(
    record.issue_execution_uuid,
    teamUUID
  );

  if (!issueExecution) {
    return null;
  }

  return {
    ...(await toIssueAgentExecutionHistoryRecord(record)),
    issueExecution: toIssueExecutionHistoryBaseRecord(issueExecution)
  };
}

export async function findIssueAgentExecutionHistoryTeamUUID(
  uuid: string
): Promise<string | null> {
  const entries = await issueAgentExecutionHistoryStore.getMany();
  const matchedEntry = entries.find((entry) => entry.value.uuid === uuid);

  return matchedEntry?.value.team_uuid ?? null;
}

export async function getAgentVersionExecutionAggregate(
  agentUUID: string,
  agentVersion: number,
  teamUUID: string
): Promise<AgentVersionExecutionAggregate> {
  const records = (await listTeamIssueAgentExecutionHistoryEntries(teamUUID))
    .map((entry) => entry.value)
    .filter(
      (record) =>
        record.agent_uuid === agentUUID &&
        record.agent_version === agentVersion &&
        ['success', 'failure', 'blocked'].includes(record.status)
    );
  const attemptsByExecution = new Map<string, number>();

  for (const record of records) {
    attemptsByExecution.set(
      record.issue_execution_uuid,
      (attemptsByExecution.get(record.issue_execution_uuid) ?? 0) + 1
    );
  }

  const retryCount = Array.from(attemptsByExecution.values()).reduce(
    (total, count) => total + Math.max(0, count - 1),
    0
  );
  const tokenValues = records.flatMap((record) => [
    record.usage_input_tokens,
    record.usage_output_tokens
  ]);
  const tokensKnown =
    records.length > 0 &&
    records.every(
      (record) =>
        typeof record.usage_input_tokens === 'number' &&
        typeof record.usage_output_tokens === 'number' &&
        record.usage_input_tokens + record.usage_output_tokens > 0
    );

  return {
    totalSamples: records.length,
    successCount: records.filter((record) => record.status === 'success')
      .length,
    failureCount: records.filter((record) => record.status === 'failure')
      .length,
    blockedCount: records.filter((record) => record.status === 'blocked')
      .length,
    retryCount,
    totalTokens: tokensKnown
      ? tokenValues.reduce<number>(
          (total, value) => total + Number(value ?? 0),
          0
        )
      : null,
    averageAttempts:
      attemptsByExecution.size > 0
        ? records.length / attemptsByExecution.size
        : 0
  };
}

export async function listAgentVersionExecutionSamples(
  agentUUID: string,
  agentVersion: number,
  teamUUID: string,
  limit = 20
): Promise<IssueAgentExecutionHistoryRecord[]> {
  const entries = (await listTeamIssueAgentExecutionHistoryEntries(teamUUID))
    .map((entry) => entry.value)
    .filter(
      (record) =>
        record.agent_uuid === agentUUID &&
        record.agent_version === agentVersion &&
        ['success', 'failure', 'blocked'].includes(record.status)
    )
    .sort(
      (left, right) =>
        (right.finished_at || right.updated_at) -
        (left.finished_at || left.updated_at)
    )
    .slice(0, Math.max(1, Math.min(limit, 20)));

  return Promise.all(entries.map(toIssueAgentExecutionHistoryRecord));
}

export async function deleteIssueAgentExecutionHistoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const record = await getStoredIssueAgentExecutionHistoryByUUID(
    uuid,
    teamUUID
  );

  if (!record) {
    return;
  }

  await Promise.all([
    deleteObject(record.prompt_object_key),
    deleteObject(record.execute_payload_object_key),
    deleteObject(record.execute_option_object_key),
    deleteObject(record.execute_result_object_key),
    deleteObject(
      getRawExecuteResultObjectKey(record.team_uuid, record.uuid)
    ).catch(() => undefined),
    deleteObject(record.logs_object_key)
  ]);
  await issueAgentExecutionHistoryStore.delete(
    getIssueAgentExecutionHistoryKey(teamUUID, uuid)
  );
}

export async function updateIssueAgentExecutionHistory(
  input: {
    uuid: string;
    prompt?: string;
    status: string;
    logs: string;
    executePayload?: JsonObject;
    executeOption?: JsonObject;
    executeResult: JsonObject;
    rawExecuteResult?: string;
    executeClientUUID: string | null;
    executeClientName: string | null;
    usageInputTokens?: number | null;
    usageOutputTokens?: number | null;
    queuedAt?: Date | null;
    lastReportedAt?: Date | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
  teamUUID: string
) {
  const record = await getStoredIssueAgentExecutionHistoryByUUID(
    input.uuid,
    teamUUID
  );

  if (!record) {
    throw new Error(
      `Issue agent execution history not found in storage: ${input.uuid}`
    );
  }

  const promptObjectKey = record.prompt_object_key;
  const executePayloadObjectKey = record.execute_payload_object_key;
  const executeOptionObjectKey = record.execute_option_object_key;
  const executeResultObjectKey = record.execute_result_object_key;
  const rawExecuteResultObjectKey =
    input.rawExecuteResult !== undefined
      ? getRawExecuteResultObjectKey(teamUUID, input.uuid)
      : undefined;
  const logsObjectKey = record.logs_object_key;

  const writes: Promise<void>[] = [
    uploadTextObject(logsObjectKey, input.logs),
    uploadObjectJson(executeResultObjectKey, input.executeResult)
  ];

  if (input.prompt !== undefined) {
    writes.push(uploadTextObject(promptObjectKey, input.prompt));
  }

  if (input.executePayload !== undefined) {
    writes.push(
      uploadObjectJson(executePayloadObjectKey, input.executePayload)
    );
  }

  if (input.executeOption !== undefined) {
    writes.push(uploadObjectJson(executeOptionObjectKey, input.executeOption));
  }

  if (input.rawExecuteResult !== undefined && rawExecuteResultObjectKey) {
    writes.push(
      uploadTextObject(rawExecuteResultObjectKey, input.rawExecuteResult)
    );
  }

  await Promise.all(writes);

  const nextRecord: StoredIssueAgentExecutionHistoryEntity = {
    ...record,
    status: input.status,
    usage_input_tokens:
      input.usageInputTokens !== undefined
        ? normalizeOptionalNumber(input.usageInputTokens)
        : record.usage_input_tokens,
    usage_output_tokens:
      input.usageOutputTokens !== undefined
        ? normalizeOptionalNumber(input.usageOutputTokens)
        : record.usage_output_tokens,
    execute_client_uuid: normalizeOptionalString(input.executeClientUUID),
    execute_client_name: normalizeOptionalString(input.executeClientName),
    queued_at:
      input.queuedAt !== undefined
        ? toTimestamp(input.queuedAt)
        : record.queued_at,
    last_reported_at:
      input.lastReportedAt !== undefined
        ? toTimestamp(input.lastReportedAt)
        : record.last_reported_at,
    started_at:
      input.startedAt !== undefined
        ? toTimestamp(input.startedAt)
        : record.started_at,
    finished_at:
      input.finishedAt !== undefined
        ? toTimestamp(input.finishedAt)
        : record.finished_at,
    updated_at: Date.now()
  };

  await issueAgentExecutionHistoryStore.set(
    getIssueAgentExecutionHistoryKey(teamUUID, input.uuid),
    nextRecord
  );

  const issueExecution = await getStoredIssueExecutionHistoryByUUID(
    nextRecord.issue_execution_uuid,
    teamUUID
  );

  if (!issueExecution) {
    throw new Error(
      `Issue execution history not found in storage: ${nextRecord.issue_execution_uuid}`
    );
  }

  return {
    ...(await toIssueAgentExecutionHistoryRecord(nextRecord)),
    issueExecution: toIssueExecutionHistoryBaseRecord(issueExecution)
  };
}

export async function updateIssueExecutionHistory(
  input: {
    uuid: string;
    status: string;
    currentAgentUUID: string;
    blockReason?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
  teamUUID: string
) {
  const record = await getStoredIssueExecutionHistoryByUUID(
    input.uuid,
    teamUUID
  );

  if (!record) {
    throw new Error(
      `Issue execution history not found in storage: ${input.uuid}`
    );
  }

  const nextRecord: StoredIssueExecutionHistoryEntity = {
    ...record,
    status: input.status,
    block_reason:
      input.blockReason !== undefined
        ? normalizeOptionalString(input.blockReason)
        : record.block_reason,
    current_agent_uuid: input.currentAgentUUID,
    started_at:
      input.startedAt !== undefined
        ? toTimestamp(input.startedAt)
        : record.started_at,
    finished_at:
      input.finishedAt !== undefined
        ? toTimestamp(input.finishedAt)
        : record.finished_at,
    updated_at: Date.now()
  };

  await issueExecutionHistoryStore.set(
    getIssueExecutionHistoryKey(teamUUID, input.uuid),
    nextRecord
  );
}

export async function deleteIssueExecutionHistoryByUUID(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const record = await getStoredIssueExecutionHistoryByUUID(uuid, teamUUID);

  if (!record) {
    return;
  }

  await issueExecutionHistoryStore.delete(
    getIssueExecutionHistoryKey(teamUUID, uuid)
  );
}

export async function listRunnableIssueExecutionHistories(
  teamUUID: string
): Promise<IssueExecutionHistoryRecord[]> {
  const entries = await listTeamIssueExecutionHistoryEntries(teamUUID);
  const runnableEntries = entries
    .map((entry) => entry.value)
    .filter(
      (entry) => entry.status === 'created' || entry.status === 'executing'
    )
    .sort((left, right) => left.created_at - right.created_at);

  return Promise.all(
    runnableEntries.map((entry) =>
      materializeIssueExecutionHistoryRecord(entry, teamUUID)
    )
  );
}
