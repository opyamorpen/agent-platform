import { randomUUID } from 'node:crypto';
import {
  parseAgentOutputString,
  parseAgentRevisionSummary
} from '@ones-ai-workflow/shared';
import type {
  AgentConfig,
  AgentInput,
  AgentInputField,
  AgentOutputField,
  AgentOutputSetValueField,
  AgentClient,
  AgentClientConnectPollResponse,
  AgentClientConnectRequest,
  AgentClientConnectResponse,
  AgentClientTask,
  AgentClientTaskReport,
  IssueExecutionStatus,
  ParsedAgentRevisionSummary,
  ParsedAgentWikiPageOutput,
  RefObject
} from '@ones-ai-workflow/shared';
import { findAgentByUUID, findAgentVersion } from '../agents/repository.js';
import {
  findAgentWorkspaceByUUID,
  listRepositoriesByAgentWorkspaceUUID
} from '../agent-workspaces/repository.js';
import { listWorkspaceCredentialsByWorkspaceUUID } from '../agent-workspaces/credentials-repository.js';
import {
  getAgentWorkspaceCloneAuth,
  getAgentWorkspaceRuntimeEnv
} from '../agent-workspaces/service.js';
import {
  findIssueAgentExecutionHistoryByUUID,
  findIssueAgentExecutionHistoryTeamUUID,
  findIssueExecutionHistoryByUUID,
  createIssueAgentExecutionHistories,
  listIssueExecutionHistoriesByDispatchedIssueUUID,
  listRunnableIssueExecutionHistories,
  updateDispatchedIssueLatestExecution,
  updateIssueAgentExecutionHistory,
  updateIssueExecutionHistory,
  type JsonObject,
  type IssueAgentExecutionHistoryRecord,
  type IssueAgentExecutionHistoryWithExecutionRecord,
  type IssueExecutionHistoryRecord
} from '../executions/repository.js';
import { isLoopRuntimeEnabled } from '../loop-runtime-config/service.js';
import {
  buildLoopCompletionComment,
  buildLoopContextXml,
  buildLoopEscalationComment,
  buildLoopRevisionComment,
  buildNextLoopAttemptUUID,
  calculateLoopBudget,
  decideLoopGate,
  isAutomaticLoopAttempt,
  isSameLoopLifecycleComment,
  isLoopPolicyRuntimeEligible,
  reviewLoopCandidate,
  type LoopBudgetSnapshot,
  type LoopReviewResult
} from '../executions/loop-engineering.js';
import {
  listAllWorkflowNodes,
  listWorkflowTeamUUIDs,
  listWorkflows,
  type WorkflowNodeRecord
} from '../workflows/repository.js';
import {
  createIssue,
  executeIssueWorkflow,
  getIssue,
  listIssueFieldOptions,
  listIssueComments,
  patchIssueFields,
  searchIssueUsers,
  getIssueFieldValues,
  ISSUE_COMMENT_FIELD_UUID,
  ISSUE_DISPLAY_ID_FIELD_UUID,
  ISSUE_ATTACHMENT_FIELD_UUID,
  findIssueByDisplayId,
  listExecutableIssueWorkflows,
  listIssueStatuses,
  sendIssueComment,
  uploadIssueAttachment,
  updateIssueFields
} from '../../ones/issue.js';
import type { OnesOpenApiContext } from '../../ones/context.js';
import type { OnesOpenApiIssueComment } from '../../ones/open-api/types.js';
import {
  OnesAuthError,
  OnesConfigError,
  OnesRequestError,
  OnesResponseError
} from '../../ones/errors.js';
import { sha256 } from '../../lib/agent-client-auth.js';
import { getLogger } from '../../lib/logger.js';
import { readFile, stat } from 'node:fs/promises';
import {
  buildAgentInputContextXml,
  buildAgentPrompt
} from '../agents/prompt-render.js';
import {
  buildRevisionRuntimeContext,
  loadAppliedWriteSnapshot,
  RevisionContextBuildError,
  type AppliedWriteSnapshot
} from '../executions/revision-context.js';
import { buildRevisionSummaryComment } from '../executions/revision-summary.js';
import {
  loadAgentClientTaskAttachment,
  removeAgentClientTaskAttachments,
  stageAgentClientTaskAttachments as stageAgentClientTaskAttachmentsInStorage
} from './attachment-staging.js';
import {
  activateAgentClient,
  approveAgentClient,
  findAgentClientByUUID,
  listAgentClients,
  revokeAgentClient,
  touchAgentClientExchange,
  updateAgentClientDisplay,
  upsertAgentClientConnectionRequest
} from './repository.js';
import { buildAgentWikiRuntimeContext } from './wiki-context.js';
import {
  applyWikiWritePlan,
  buildWikiWritePlan,
  type WikiWritePlan
} from './wiki-output.js';

type WorkflowNodeMap = Map<string, WorkflowNodeRecord>;
type AgentConfigCache = Map<string, AgentConfig | null>;
type AgentTaskBindings = {
  sourceWorkspace: AgentClientTask['sourceWorkspace'];
  skillUUIDs: string[];
  readableEnvKeys: string[];
};
type AgentTaskBindingsCache = Map<string, AgentTaskBindings>;
type ScopedIssueFieldValue = {
  issueUUID: string;
  fieldUUID: string;
  value: unknown;
  outputFieldUUIDPath: string;
};
type ScopedStatusFieldValue = {
  issueUUID: string;
  fieldUUID: string;
  value: {
    uuid: string | null;
    name: string | null;
  };
  outputFieldUUIDPath: string;
};
type ScopedIssueComment = {
  issueUUID: string;
  text: string;
  outputFieldUUIDPath: string;
};
type AttachmentUpload = {
  resourceToken: string;
  fileName: string;
  localPath: string;
};
type AttachmentOutputRecord = {
  outputName: string;
  uploads: AttachmentUpload[];
};
type ScopedIssueAttachment = {
  issueUUID: string;
  outputFieldUUIDPath: string;
  uploads: AttachmentUpload[];
};
type DeferredIssueAttachmentFieldWrite = {
  outputFieldUUIDPath: string;
  targetFieldUUID: string;
  targetFieldValueType: 'single_reference_object' | 'multi_reference_object';
  existingAttachmentUUIDs: string[];
  uploads: AttachmentUpload[];
  targetIssueUUID?: string;
  createPlanIndex?: number;
};
type CreateIssueFieldValue = {
  fieldUUID: string;
  value: unknown;
};
type ReferenceFieldWriteMode = 'set' | 'append';
type CreateRefObjectPlan = {
  outputFieldUUIDPath: string;
  targetIssueUUID: string;
  targetFieldUUID: string;
  targetFieldValueType: 'single_reference_object' | 'multi_reference_object';
  fieldWriteMode: ReferenceFieldWriteMode;
  fieldValues: CreateIssueFieldValue[];
};
type DeferredIssueReferenceWrite = {
  outputFieldUUIDPath: string;
  targetIssueUUID: string;
  targetFieldUUID: string;
  targetFieldValueType: 'single_reference_object' | 'multi_reference_object';
  fieldWriteMode: ReferenceFieldWriteMode;
  updatedIssueUUIDs: string[];
};
type OutputWritePlan = {
  createRefObjectPlans: CreateRefObjectPlan[];
  deferredIssueReferenceWrites: DeferredIssueReferenceWrite[];
  deferredIssueAttachmentFieldWrites: DeferredIssueAttachmentFieldWrite[];
  issueFieldValues: ScopedIssueFieldValue[];
  issueComments: ScopedIssueComment[];
  issueAttachments: ScopedIssueAttachment[];
  statusFieldValues: ScopedStatusFieldValue[];
  wikiWrites: WikiWritePlan[];
};
type ParsedAgentSetValueOutput = {
  mode: 'set_value';
  fieldUUIDPath: string;
  value: string;
};
type ParsedAgentOutputObject = {
  objectType: string;
  objectWriteMode: 'create' | 'update' | null;
  objectUUID: string | null;
  objectName: string | null;
  fields: Record<string, ParsedAgentObjectFieldValue>;
};
type ParsedAgentObjectFieldValue = string | ParsedAgentOutputObject[];
type ParsedAgentObjectValuesOutput = {
  mode: 'object_values';
  fieldUUIDPath: string;
  fieldWriteMode: ReferenceFieldWriteMode | null;
  objects: ParsedAgentOutputObject[];
};
type ParsedAgentOutputItem =
  | ParsedAgentSetValueOutput
  | ParsedAgentObjectValuesOutput
  | ParsedAgentWikiPageOutput;
type ParsedTaskExecuteResult = {
  outputs: ParsedAgentOutputItem[];
  revisionSummary: ParsedAgentRevisionSummary | null;
  revisionSummaryWarning?: string;
};
type PreparedTaskReport = {
  taskUUID: string;
  issueExecutionUUID: string;
  dispatchedIssueUUID: string;
  workflowNodeUUID: string;
  executorUUID: string;
  executorName: string;
  triggerStatusUUID: string;
  triggerStatusName: string;
  triggerAssigneeUUID: string;
  triggerAssigneeName: string;
  status: AgentClientTaskReport['status'];
  logs: string;
  executeResult: ParsedTaskExecuteResult;
  outputWritePlan: OutputWritePlan;
  deterministicValidation: {
    passed: boolean;
    errors: string[];
    requiresEscalation: boolean;
  };
  startedAt: Date | null;
  finishedAt: Date | null;
};
type AppliedWikiWriteSummary = {
  action: WikiWritePlan['action'];
  outputFieldUUIDPath: string;
  pageTitle: string;
};
type AgentClientTaskReportRequest = {
  reports: AgentClientTaskReport[];
};
type AgentClientTaskReportResponse = {
  accepted: true;
};
type AgentClientTaskClaimRequest = {
  availableSlots: number;
};
type AgentClientTaskClaimResponse = {
  tasks: AgentClientTask[];
};

const ISSUE_STATUS_FIELD_UUID = 'field005';
const ISSUE_ASSIGNEE_FIELD_UUID = 'field004';
const ISSUE_TITLE_FIELD_UUID = 'field001';
const ISSUE_PROJECT_FIELD_UUID = 'field006';
const ISSUE_TYPE_FIELD_UUID = 'field007';
const ISSUE_WATCHERS_FIELD_UUID = 'field008';
const ISSUE_DESCRIPTION_FIELD_UUID = 'field002';
const PARENT_ISSUE_FIELD_UUID = 'field014';
const COMMENT_OBJECT_TYPE = 'comment';
const COMMENT_CONTENT_FIELD_UUID = 'content';
const ATTACHMENT_OBJECT_TYPE = 'attachment';
const ATTACHMENT_LOCAL_PATH_FIELD_UUID = 'local_path';
const SINGLE_REFERENCE_OBJECT_VALUE_TYPE = 'single_reference_object';
const MULTI_REFERENCE_OBJECT_VALUE_TYPE = 'multi_reference_object';
const AGENT_CLIENT_OFFLINE_THRESHOLD_MS = 10_000;
const TASK_STARTED_COMMENT_FETCH_LIMIT = 100;
const logger = getLogger('agent-client-exchange');
type OutputWriteStage =
  | 'creates'
  | 'fields'
  | 'comments'
  | 'attachments'
  | 'wiki'
  | 'statuses'
  | 'post_actions';

type IssueTriggerSnapshot = {
  statusUUID: string;
  assigneeUUID: string;
};

type PrepareExecuteResultPhase =
  | 'parse_execute_result'
  | 'build_output_write_plan'
  | 'build_create_issue_plan';
type PrepareExecuteResultErrorContext = {
  phase?: PrepareExecuteResultPhase;
  outputAlias?: string;
  fieldUUID?: string;
  fieldValueType?: string;
  rawValueSummary?: string;
  referenceName?: string;
  referenceMode?: 'search_users' | 'list_field_options';
};

function isCommentField(fieldUUID: string): boolean {
  return fieldUUID === ISSUE_COMMENT_FIELD_UUID;
}

function isCommentOutputField(field: {
  fieldUUID: string;
  fieldReferenceObjectType: string | null;
}): boolean {
  return (
    isCommentField(field.fieldUUID) ||
    field.fieldReferenceObjectType === COMMENT_OBJECT_TYPE
  );
}

function isAttachmentField(field: {
  fieldUUID?: string;
  fieldReferenceObjectType: string | null;
}): boolean {
  return (
    field.fieldUUID === ISSUE_ATTACHMENT_FIELD_UUID ||
    field.fieldReferenceObjectType === ATTACHMENT_OBJECT_TYPE
  );
}

function isAttachmentOutputField(field: {
  fieldUUID: string;
  fieldReferenceObjectType: string | null;
}): boolean {
  return isAttachmentField(field);
}

function getReferenceFieldWriteMode(
  parsedOutput: ParsedAgentObjectValuesOutput
): ReferenceFieldWriteMode {
  return parsedOutput.fieldWriteMode ?? 'set';
}

function getAgentClientStatus(
  lastExchangeAt: Date | null,
  now: Date = new Date()
): AgentClient['runtimeStatus'] {
  if (!lastExchangeAt) {
    return 'offline';
  }

  return now.getTime() - lastExchangeAt.getTime() <=
    AGENT_CLIENT_OFFLINE_THRESHOLD_MS
    ? 'online'
    : 'offline';
}

function toAgentClient(
  record: {
    hostname: string;
    version: string;
    connectionStatus: AgentClient['connectionStatus'];
    uuid: string;
    name: string;
    requestedAt: Date;
    approvedAt: Date | null;
    revokedAt: Date | null;
    lastExchangeAt: Date | null;
  },
  now: Date = new Date()
): AgentClient {
  return {
    uuid: record.uuid,
    name: record.name,
    hostname: record.hostname,
    version: record.version,
    connectionStatus: record.connectionStatus,
    runtimeStatus:
      record.connectionStatus === 'active'
        ? getAgentClientStatus(record.lastExchangeAt, now)
        : 'offline',
    requestedAt: record.requestedAt.toISOString(),
    approvedAt: record.approvedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    lastExchangeAt: record.lastExchangeAt?.toISOString() ?? null
  };
}

export class InvalidAgentClientTaskReportError extends Error {
  constructor(taskUUID: string) {
    super(`Invalid agent client task report: ${taskUUID}`);
    this.name = 'InvalidAgentClientTaskReportError';
  }
}

export class AgentClientNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Agent client not found: ${uuid}`);
    this.name = 'AgentClientNotFoundError';
  }
}

export class InvalidAgentClientConnectionRequestError extends Error {
  constructor() {
    super('Invalid agent client connection request');
    this.name = 'InvalidAgentClientConnectionRequestError';
  }
}

export class AgentClientInvalidAttachmentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentClientInvalidAttachmentUploadError';
  }
}

class PrepareExecuteResultError extends Error {
  readonly context: PrepareExecuteResultErrorContext;

  constructor(
    message: string,
    context: PrepareExecuteResultErrorContext,
    cause?: unknown
  ) {
    super(message, {
      cause
    });
    this.name = 'PrepareExecuteResultError';
    this.context = context;
  }
}

export async function createAgentClientConnection(
  request: AgentClientConnectRequest
): Promise<AgentClientConnectResponse> {
  const pendingRequestUUID = randomUUID();

  await upsertAgentClientConnectionRequest({
    uuid: request.client.uuid,
    name: request.client.name,
    hostname: request.client.hostname,
    version: request.client.version,
    pendingRequestUUID,
    pendingConnectCodeHash: sha256(request.connectCode),
    requestedAt: new Date()
  });

  return {
    connectionRequestUUID: pendingRequestUUID,
    status: 'pending_approval',
    pollAfterMs: 3000
  };
}

export async function pollAgentClientConnection(input: {
  clientUUID: string;
  connectionRequestUUID: string;
  connectCode: string;
}): Promise<AgentClientConnectPollResponse> {
  const agentClient = await findAgentClientByUUID(input.clientUUID);

  if (
    !agentClient ||
    agentClient.pendingRequestUUID !== input.connectionRequestUUID ||
    agentClient.pendingConnectCodeHash !== sha256(input.connectCode)
  ) {
    throw new InvalidAgentClientConnectionRequestError();
  }

  if (agentClient.connectionStatus === 'revoked') {
    return {
      status: 'revoked',
      message: 'Agent Client 连接已被撤销'
    };
  }

  if (agentClient.connectionStatus !== 'approved') {
    return {
      status: 'pending_approval',
      pollAfterMs: 3000
    };
  }

  const accessToken = `${randomUUID()}${randomUUID()}`;
  const activatedClient = await activateAgentClient({
    uuid: input.clientUUID,
    tokenHash: sha256(accessToken),
    activatedAt: new Date()
  });

  if (!activatedClient) {
    throw new AgentClientNotFoundError(input.clientUUID);
  }

  return {
    status: 'approved',
    accessToken
  };
}

export async function getAgentClients(): Promise<AgentClient[]> {
  const agentClients = await listAgentClients();
  const now = new Date();

  return agentClients.map((agentClient) => toAgentClient(agentClient, now));
}

export async function approveAgentClientConnection(
  uuid: string
): Promise<AgentClient> {
  const agentClient = await approveAgentClient({
    uuid,
    approvedAt: new Date()
  });

  if (!agentClient) {
    throw new AgentClientNotFoundError(uuid);
  }

  return toAgentClient(agentClient);
}

export async function revokeAgentClientConnection(
  uuid: string
): Promise<AgentClient> {
  const agentClient = await revokeAgentClient(uuid, new Date());

  if (!agentClient) {
    throw new AgentClientNotFoundError(uuid);
  }

  return toAgentClient(agentClient);
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  return value as JsonObject;
}

export function getExecutorOnesContext(
  task: {
    executorUUID: string;
  },
  teamUUID: string
): OnesOpenApiContext {
  return {
    teamUUID,
    userUUID: task.executorUUID
  };
}

export function didIssueTriggerChange(
  trigger: IssueTriggerSnapshot,
  current: IssueTriggerSnapshot
): boolean {
  return (
    trigger.statusUUID !== current.statusUUID ||
    trigger.assigneeUUID !== current.assigneeUUID
  );
}

export function shouldBlockAfterConsecutiveFailures(
  workflowNodeUUID: string,
  previousExecutions: Array<
    Pick<IssueExecutionHistoryRecord, 'workflowNodeUUID' | 'status'>
  >
): boolean {
  let consecutiveFailures = 0;

  for (const execution of previousExecutions) {
    if (execution.workflowNodeUUID !== workflowNodeUUID) {
      break;
    }

    if (execution.status !== 'failure') {
      break;
    }

    consecutiveFailures += 1;

    if (consecutiveFailures >= 1) {
      return true;
    }
  }

  return false;
}

function isRefObject(value: unknown): value is RefObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as RefObject).uuid === 'string' &&
    typeof (value as RefObject).name === 'string'
  );
}

export function normalizeExecutePayloadValue(value: unknown): unknown {
  if (isRefObject(value)) {
    return formatRefObjectForPrompt(value);
  }

  if (Array.isArray(value) && value.every((item) => isRefObject(item))) {
    return value
      .map((item) => `- ${formatRefObjectForPrompt(item)}`)
      .join('\n');
  }

  return value;
}

function formatRefObjectForPrompt(value: RefObject): string {
  return `${value.name} [uuid=${value.uuid}]`;
}

export function getTaskExecuteOptionMetadata(agentConfig: AgentConfig) {
  return {
    outputPaths: agentConfig.outputs.map((output) => output.field.uuid),
    attachmentOutputPaths: agentConfig.outputs.flatMap((output) => {
      const attachmentOutputPaths: string[] = [];

      if (
        output.subFields.length === 0 &&
        isAttachmentField({
          fieldUUID: output.field.uuid,
          fieldReferenceObjectType: output.field.referenceObjectType
        })
      ) {
        attachmentOutputPaths.push(output.field.uuid);
      }

      if (output.field.referenceObjectType === 'issue') {
        for (const subField of output.subFields) {
          if (
            isAttachmentField({
              fieldUUID: subField.field.uuid,
              fieldReferenceObjectType: subField.field.referenceObjectType
            })
          ) {
            attachmentOutputPaths.push(
              buildAttachmentUploadOutputName(
                output.field.uuid,
                subField.field.uuid
              )
            );
          }
        }
      }

      return attachmentOutputPaths;
    })
  };
}

function getTaskAttachmentUploads(
  executeOption: unknown
): AttachmentOutputRecord[] {
  if (
    !executeOption ||
    typeof executeOption !== 'object' ||
    Array.isArray(executeOption)
  ) {
    return [];
  }

  return normalizeAttachmentOutputRecords(
    (executeOption as { attachmentUploads?: unknown }).attachmentUploads
  );
}

function getRevisionCurrentOutputRefUUIDs(
  executeOption: unknown,
  fieldUUID: string
): string[] {
  if (
    !executeOption ||
    typeof executeOption !== 'object' ||
    Array.isArray(executeOption)
  ) {
    return [];
  }
  const revisionContext = (executeOption as { revisionContext?: unknown })
    .revisionContext;
  if (
    !revisionContext ||
    typeof revisionContext !== 'object' ||
    Array.isArray(revisionContext)
  ) {
    return [];
  }
  const currentOutputs = (revisionContext as { currentOutputs?: unknown })
    .currentOutputs;
  if (!Array.isArray(currentOutputs)) {
    return [];
  }
  const output = currentOutputs.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      (item as { fieldUUID?: unknown }).fieldUUID === fieldUUID
  ) as { value?: unknown } | undefined;
  const values = Array.isArray(output?.value) ? output.value : [output?.value];
  return Array.from(
    new Set(
      values.flatMap((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return [];
        }
        const uuid = (value as { uuid?: unknown }).uuid;
        return typeof uuid === 'string' && uuid.trim() ? [uuid.trim()] : [];
      })
    )
  );
}

function normalizeAttachmentOutputRecords(
  value: unknown
): AttachmentOutputRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (attachmentOutput): attachmentOutput is AttachmentOutputRecord =>
      typeof attachmentOutput === 'object' &&
      attachmentOutput !== null &&
      typeof (attachmentOutput as { outputName?: unknown }).outputName ===
        'string' &&
      Array.isArray((attachmentOutput as { uploads?: unknown }).uploads) &&
      (attachmentOutput as { uploads: unknown[] }).uploads.every(
        (upload) =>
          typeof upload === 'object' &&
          upload !== null &&
          typeof (upload as { resourceToken?: unknown }).resourceToken ===
            'string' &&
          typeof (upload as { fileName?: unknown }).fileName === 'string' &&
          typeof (upload as { localPath?: unknown }).localPath === 'string'
      )
  );
}

async function loadAgentConfig(
  agentUUID: string,
  agentVersion: number,
  cache: AgentConfigCache,
  teamUUID: string
): Promise<AgentConfig | null> {
  const cacheKey = `${teamUUID}:${agentUUID}:${agentVersion}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const agentVersionRecord = await findAgentVersion(
    agentUUID,
    agentVersion,
    teamUUID
  );
  const agentConfig = agentVersionRecord?.config ?? null;
  cache.set(cacheKey, agentConfig);

  return agentConfig;
}

function getAgentInputFieldPath(
  input: AgentInput,
  subField?: AgentInputField
): {
  uuidPath: string;
  namePath: string;
} {
  const uuidParts = [input.field.uuid];
  const nameParts = [input.field.name];

  if (subField) {
    uuidParts.push(subField.field.uuid);
    nameParts.push(subField.field.name);
  }

  return {
    uuidPath: uuidParts.join('.'),
    namePath: nameParts.join('.')
  };
}

function toIssueRefList(value: unknown): RefObject[] {
  if (isRefObject(value)) {
    return [value];
  }

  if (Array.isArray(value) && value.every((item) => isRefObject(item))) {
    return value;
  }

  return [];
}

export function buildWikiPageReferenceFieldValue(
  fieldValueType: 'single_reference_object' | 'multi_reference_object',
  existingValue: unknown,
  pageUUID: string
): string | string[] {
  const normalizedPageUUID = pageUUID.trim();

  if (fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE) {
    return normalizedPageUUID;
  }

  return Array.from(
    new Set(
      [
        ...toIssueRefList(existingValue).map((refObject) => refObject.uuid),
        normalizedPageUUID
      ].filter(Boolean)
    )
  );
}

function toReferenceUUIDList(value: unknown): string[] {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue ? [normalizedValue] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))
  );
}

function buildAttachmentUploadOutputName(
  outputFieldUUIDPath: string,
  fieldUUID?: string
): string {
  return fieldUUID
    ? `${outputFieldUUIDPath}.${fieldUUID}`
    : outputFieldUUIDPath;
}

function consumeAttachmentUploadsForOutput(
  outputName: string,
  declaredLocalPaths: string[],
  attachmentUploadsByOutputName: Map<string, AttachmentUpload[]>
): AttachmentUpload[] {
  if (declaredLocalPaths.length === 0) {
    return [];
  }

  const remainingUploads = attachmentUploadsByOutputName.get(outputName) ?? [];

  if (remainingUploads.length === 0) {
    throw new Error(
      `Attachment output "${outputName}" references attachments but no uploads were reported`
    );
  }

  if (declaredLocalPaths.length > remainingUploads.length) {
    throw new Error(
      `Attachment output "${outputName}" declared ${declaredLocalPaths.length} attachment object(s) but reported ${remainingUploads.length} upload(s)`
    );
  }

  const uploads = remainingUploads.slice(0, declaredLocalPaths.length);

  for (const [index, declaredLocalPath] of declaredLocalPaths.entries()) {
    const upload = uploads[index];

    if (!upload) {
      throw new Error(
        `Attachment output "${outputName}" is missing upload for "${declaredLocalPath}"`
      );
    }

    if (upload.localPath.trim() !== declaredLocalPath) {
      throw new Error(
        `Attachment output "${outputName}" local_path mismatch: declared "${declaredLocalPath}", uploaded "${upload.localPath}"`
      );
    }
  }

  attachmentUploadsByOutputName.set(
    outputName,
    remainingUploads.slice(declaredLocalPaths.length)
  );

  return uploads;
}

function buildReferenceFieldWriteValue(
  fieldValueType: 'single_reference_object' | 'multi_reference_object',
  uuids: string[]
): string | string[] {
  return fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE
    ? (uuids[0] ?? '')
    : uuids;
}

async function loadIssueFieldValue(
  issueUUID: string,
  field: {
    uuid: string;
    valueType: string;
    referenceObjectType: string | null;
  },
  onesContext: OnesOpenApiContext,
  cache: Map<string, unknown>
): Promise<unknown> {
  const cacheKey = `${issueUUID}:${field.uuid}:${field.valueType}:${field.referenceObjectType ?? ''}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const fieldValues = await getIssueFieldValues(
    issueUUID,
    [
      {
        uuid: field.uuid,
        alias: field.uuid,
        valueType: field.valueType,
        referenceObjectType: field.referenceObjectType
      }
    ],
    onesContext
  );

  if (!fieldValues) {
    throw new Error(
      `ONES issue not found when loading field value: ${issueUUID}`
    );
  }

  const value = fieldValues[field.uuid] ?? null;
  cache.set(cacheKey, value);
  return value;
}

async function resolveAgentInputValue(
  rootValue: unknown,
  subField: AgentInputField | null,
  onesContext: OnesOpenApiContext,
  cache: Map<string, unknown>
): Promise<unknown> {
  if (!subField) {
    return rootValue;
  }

  const issueRefs = toIssueRefList(rootValue);

  if (issueRefs.length === 0) {
    return Array.isArray(rootValue) ? [] : null;
  }

  const subFieldValues = await Promise.all(
    issueRefs.map((issueRef) =>
      loadIssueFieldValue(
        issueRef.uuid,
        {
          uuid: subField.field.uuid,
          valueType: subField.field.valueType,
          referenceObjectType: subField.field.referenceObjectType ?? null
        },
        onesContext,
        cache
      )
    )
  );

  if (issueRefs.length === 1) {
    return subFieldValues[0] ?? null;
  }

  return subFieldValues.flatMap((value) => {
    if (value === null || value === undefined) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  });
}

async function buildNestedAgentInputContextFields(
  issueUUID: string,
  subFields: AgentInputField[],
  onesContext: OnesOpenApiContext,
  cache: Map<string, unknown>
) {
  return Promise.all(
    subFields.map(async (subField) => ({
      fieldUUID: subField.field.uuid,
      fieldName: subField.field.name,
      fieldValueType: subField.field.valueType,
      fieldReferenceObjectType: subField.field.referenceObjectType,
      description: subField.description,
      value: await loadIssueFieldValue(
        issueUUID,
        {
          uuid: subField.field.uuid,
          valueType: subField.field.valueType,
          referenceObjectType: subField.field.referenceObjectType ?? null
        },
        onesContext,
        cache
      )
    }))
  );
}

async function buildAgentInputContextField(
  input: AgentInput,
  rootValue: unknown,
  onesContext: OnesOpenApiContext,
  cache: Map<string, unknown>
) {
  if (input.subFields.length === 0) {
    return {
      fieldUUID: input.field.uuid,
      fieldName: input.field.name,
      fieldValueType: input.field.valueType,
      fieldReferenceObjectType: input.field.referenceObjectType,
      description: input.description,
      value: rootValue
    };
  }

  const issueRefs = toIssueRefList(rootValue);
  const refObjects = await Promise.all(
    issueRefs.map(async (issueRef) => ({
      objectType: 'issue',
      ...issueRef,
      fields: await buildNestedAgentInputContextFields(
        issueRef.uuid,
        input.subFields,
        onesContext,
        cache
      )
    }))
  );

  return {
    fieldUUID: input.field.uuid,
    fieldName: input.field.name,
    fieldValueType: input.field.valueType,
    fieldReferenceObjectType: input.field.referenceObjectType,
    description: input.description,
    value:
      issueRefs.length === 0
        ? Array.isArray(rootValue)
          ? []
          : null
        : input.field.valueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE
          ? (refObjects[0] ?? null)
          : refObjects
  };
}

async function buildInputContext(
  issueUUID: string,
  inputs: AgentInput[],
  onesContext: OnesOpenApiContext
) {
  const rootFields = Array.from(
    new Map(
      inputs.map(
        (input) =>
          [
            input.field.uuid,
            {
              uuid: input.field.uuid,
              alias: input.field.uuid,
              valueType: input.field.valueType,
              referenceObjectType: input.field.referenceObjectType
            }
          ] as const
      )
    ).values()
  );
  const rootFieldValues = await getIssueFieldValues(
    issueUUID,
    rootFields,
    onesContext
  );
  const rootIssue = await getIssue(issueUUID, onesContext);

  if (!rootFieldValues || !rootIssue) {
    throw new Error(
      `ONES issue not found when building input context: ${issueUUID}`
    );
  }

  const executePayload: Record<string, unknown> = {};
  const valueCache = new Map<string, unknown>();
  const inputContextFields = await Promise.all(
    inputs.map(async (input) => {
      const rootValue = rootFieldValues[input.field.uuid] ?? null;

      if (input.subFields.length === 0) {
        const path = getAgentInputFieldPath(input);
        const resolvedValue = await resolveAgentInputValue(
          rootValue,
          null,
          onesContext,
          valueCache
        );

        executePayload[path.uuidPath] = resolvedValue;
      } else {
        await Promise.all(
          input.subFields.map(async (subField) => {
            const path = getAgentInputFieldPath(input, subField);
            const resolvedValue = await resolveAgentInputValue(
              rootValue,
              subField,
              onesContext,
              valueCache
            );

            executePayload[path.uuidPath] = resolvedValue;
          })
        );
      }

      return buildAgentInputContextField(
        input,
        rootValue,
        onesContext,
        valueCache
      );
    })
  );
  const inputContextXml = buildAgentInputContextXml({
    objectType: 'issue',
    objectUUID: issueUUID,
    objectName: rootIssue.name?.trim() || issueUUID,
    fields: inputContextFields
  });

  return {
    executePayload,
    inputContextXml
  };
}

async function getParentIssueRef(
  issueUUID: string,
  onesContext: OnesOpenApiContext
): Promise<RefObject | null> {
  const parentFieldValues = await getIssueFieldValues(
    issueUUID,
    [
      {
        uuid: PARENT_ISSUE_FIELD_UUID,
        alias: 'parent',
        valueType: SINGLE_REFERENCE_OBJECT_VALUE_TYPE
      }
    ],
    onesContext
  );

  if (!parentFieldValues) {
    throw new Error(
      `ONES issue not found when resolving parent issue: ${issueUUID}`
    );
  }

  return isRefObject(parentFieldValues.parent)
    ? parentFieldValues.parent
    : null;
}

function appendLogMessage(logs: string, message: string): string {
  const trimmedLogs = logs.trimEnd();
  return trimmedLogs ? `${trimmedLogs}\n${message}` : message;
}

export function buildTaskStartedComment(agentName: string): string {
  const normalizedAgentName = agentName.trim() || agentName || 'Agent';
  return `[${normalizedAgentName}] 已开始工作，稍后通知你结果。`;
}

export function buildTaskBlockedComment(agentName: string): string {
  const normalizedAgentName = agentName.trim() || agentName || 'Agent';
  return `[${normalizedAgentName}] 执行阻塞，联系管理员处理。`;
}

function getRevisionFeedbackCommentCount(executeOption: unknown): number {
  if (
    !executeOption ||
    typeof executeOption !== 'object' ||
    Array.isArray(executeOption)
  ) {
    return 0;
  }

  const revisionContext = (executeOption as { revisionContext?: unknown })
    .revisionContext;

  if (
    !revisionContext ||
    typeof revisionContext !== 'object' ||
    Array.isArray(revisionContext)
  ) {
    return 0;
  }

  const value = Number(
    (revisionContext as { feedbackCommentCount?: unknown }).feedbackCommentCount
  );
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function getOutputDisplayName(
  outputFieldUUIDPath: string,
  agentConfig: AgentConfig,
  appliedWrites: AppliedWriteSnapshot[]
): string {
  const rootFieldUUID =
    outputFieldUUIDPath.split('.')[0] ?? outputFieldUUIDPath;
  return (
    appliedWrites.find((write) => write.fieldUUID === rootFieldUUID)
      ?.fieldName ||
    agentConfig.outputs.find((output) => output.field.uuid === rootFieldUUID)
      ?.field.name ||
    rootFieldUUID
  );
}

function buildRevisionActualWriteDescriptions(input: {
  outputWritePlan: OutputWritePlan;
  agentConfig: AgentConfig;
  appliedWrites: AppliedWriteSnapshot[];
  appliedWikiWrites: AppliedWikiWriteSummary[];
  appliedStatusTransitions: string[];
}): string[] {
  const descriptions: string[] = [];
  const createdOutputPaths = new Set<string>();
  const push = (value: string) => {
    if (value && !descriptions.includes(value)) {
      descriptions.push(value);
    }
  };

  const createCounts = new Map<string, number>();
  for (const plan of input.outputWritePlan.createRefObjectPlans) {
    createCounts.set(
      plan.outputFieldUUIDPath,
      (createCounts.get(plan.outputFieldUUIDPath) ?? 0) + 1
    );
  }
  for (const [outputPath, count] of createCounts) {
    createdOutputPaths.add(outputPath);
    push(
      `创建并关联「${getOutputDisplayName(outputPath, input.agentConfig, input.appliedWrites)}」${count} 个工作项`
    );
  }

  for (const wikiWrite of input.appliedWikiWrites) {
    const action =
      wikiWrite.action === 'create'
        ? '创建'
        : wikiWrite.action === 'replace'
          ? '替换'
          : '追加';
    push(
      `${action} Wiki 页面「${wikiWrite.pageTitle}」并关联到「${getOutputDisplayName(wikiWrite.outputFieldUUIDPath, input.agentConfig, input.appliedWrites)}」`
    );
  }

  const updatedOutputPaths = new Set([
    ...input.outputWritePlan.issueFieldValues.map(
      (write) => write.outputFieldUUIDPath
    ),
    ...input.outputWritePlan.deferredIssueReferenceWrites.map(
      (write) => write.outputFieldUUIDPath
    ),
    ...input.outputWritePlan.deferredIssueAttachmentFieldWrites.map(
      (write) => write.outputFieldUUIDPath
    )
  ]);
  for (const outputPath of updatedOutputPaths) {
    if (!createdOutputPaths.has(outputPath)) {
      push(
        `更新「${getOutputDisplayName(outputPath, input.agentConfig, input.appliedWrites)}」`
      );
    }
  }

  if (input.outputWritePlan.issueComments.length > 0) {
    push(`新增 ${input.outputWritePlan.issueComments.length} 条评论`);
  }

  const attachmentCount = input.outputWritePlan.issueAttachments.reduce(
    (count, output) => count + output.uploads.length,
    0
  );
  if (attachmentCount > 0) {
    push(`上传 ${attachmentCount} 个附件`);
  }

  for (const statusName of input.appliedStatusTransitions) {
    push(`状态流转至「${statusName}」`);
  }

  return descriptions;
}

export function hasTaskCommentSinceQueuedAt(
  comments: readonly Pick<OnesOpenApiIssueComment, 'text' | 'createTime'>[],
  expectedText: string,
  queuedAt: Date | null
): boolean {
  const normalizedText = expectedText.trim();

  if (
    !normalizedText ||
    !(queuedAt instanceof Date) ||
    Number.isNaN(queuedAt.getTime())
  ) {
    return false;
  }

  const queuedAtMs = queuedAt.getTime();

  return comments.some((comment) => {
    if (comment.text.trim() !== normalizedText) {
      return false;
    }

    const createdAtMs = parseOnesCommentTimestamp(comment.createTime);
    return !Number.isNaN(createdAtMs) && createdAtMs >= queuedAtMs;
  });
}

export function hasTaskStartedCommentSinceQueuedAt(
  comments: readonly Pick<OnesOpenApiIssueComment, 'text' | 'createTime'>[],
  expectedText: string,
  queuedAt: Date | null
): boolean {
  return hasTaskCommentSinceQueuedAt(comments, expectedText, queuedAt);
}

export function shouldSendTaskStartedComment(
  previousStatus: string,
  nextStatus: string
): boolean {
  return previousStatus !== 'running' && nextStatus === 'running';
}

export function shouldSendRevisionSummaryComment(input: {
  finalStatus: string;
  revisionContextEnabled: boolean;
  triggerReason: string;
}): boolean {
  return (
    input.finalStatus === 'success' &&
    input.revisionContextEnabled &&
    input.triggerReason === 'revision'
  );
}

function parseOnesCommentTimestamp(value?: string): number {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return Number.NaN;
  }

  const numericValue = Number(normalizedValue);

  if (Number.isFinite(numericValue)) {
    if (Math.abs(numericValue) >= 1e15) {
      return numericValue / 1000;
    }

    if (Math.abs(numericValue) < 1e11) {
      return numericValue * 1000;
    }

    return numericValue;
  }

  return Date.parse(normalizedValue);
}

function summarizeForLog(
  value: string | undefined,
  limit = 500
): string | undefined {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return undefined;
  }

  return normalizedValue.length <= limit
    ? normalizedValue
    : `${normalizedValue.slice(0, limit)}...`;
}

function summarizeUnknownForLog(
  value: unknown,
  limit = 500
): string | undefined {
  if (typeof value === 'string') {
    return summarizeForLog(value, limit);
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  try {
    return summarizeForLog(JSON.stringify(value), limit);
  } catch {
    return summarizeForLog(String(value), limit);
  }
}

function buildOutputWriteFailureMessage(
  stage: OutputWriteStage,
  error: unknown
): string {
  const baseMessage = `[system] failed to write ${stage} to ONES`;

  if (error instanceof OnesRequestError) {
    return `${baseMessage}: ${error.status} ${error.url}`;
  }

  if (error instanceof OnesResponseError) {
    return `${baseMessage}: ${error.message}`;
  }

  return `${baseMessage}: ${error instanceof Error ? error.message : String(error)}`;
}

function findNestedError<T extends Error>(
  error: unknown,
  match: (candidate: unknown) => candidate is T
): T | null {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && !visited.has(current)) {
    if (match(current)) {
      return current;
    }

    visited.add(current);

    if (!(current instanceof Error)) {
      return null;
    }

    current = current.cause;
  }

  return null;
}

function withPrepareExecuteResultContext(
  error: unknown,
  context: PrepareExecuteResultErrorContext
): PrepareExecuteResultError {
  if (error instanceof PrepareExecuteResultError) {
    return new PrepareExecuteResultError(
      error.message,
      {
        ...error.context,
        ...context
      },
      error.cause ?? error
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return new PrepareExecuteResultError(message, context, error);
}

function formatPrepareExecuteResultContext(
  context: PrepareExecuteResultErrorContext
): string[] {
  const parts: string[] = [];

  if (context.phase) {
    parts.push(`phase=${context.phase}`);
  }

  if (context.outputAlias) {
    parts.push(`output=${context.outputAlias}`);
  }

  if (context.fieldUUID) {
    parts.push(`field=${context.fieldUUID}`);
  }

  if (context.fieldValueType) {
    parts.push(`valueType=${context.fieldValueType}`);
  }

  if (context.referenceMode) {
    parts.push(`lookup=${context.referenceMode}`);
  }

  if (context.referenceName) {
    parts.push(`reference=${context.referenceName}`);
  }

  if (context.rawValueSummary) {
    parts.push(`value=${context.rawValueSummary}`);
  }

  return parts;
}

function buildPrepareExecuteResultFailureMessage(error: unknown): string {
  const baseMessage =
    '[system] failed to prepare execute result for ONES write-back';
  const preparedError = findNestedError(
    error,
    (candidate): candidate is PrepareExecuteResultError =>
      candidate instanceof PrepareExecuteResultError
  );
  const requestError = findNestedError(
    error,
    (candidate): candidate is OnesRequestError =>
      candidate instanceof OnesRequestError
  );
  const responseError = findNestedError(
    error,
    (candidate): candidate is OnesResponseError =>
      candidate instanceof OnesResponseError
  );
  const parts = preparedError
    ? formatPrepareExecuteResultContext(preparedError.context)
    : [];

  if (requestError) {
    parts.push(`ONES ${requestError.status} ${requestError.url}`);
  } else if (responseError?.code) {
    parts.push(`ONES code=${responseError.code}`);
  }

  const detailPrefix =
    parts.length > 0 ? `${baseMessage} (${parts.join(', ')})` : baseMessage;
  const message = error instanceof Error ? error.message : String(error);

  return `${detailPrefix}: ${message}`;
}

function buildOutputWriteErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof OnesRequestError) {
    return {
      error: error.message,
      onesStatus: error.status,
      onesUrl: error.url,
      onesResponseBody: summarizeForLog(error.responseBody)
    };
  }

  if (error instanceof OnesResponseError) {
    return {
      error: error.message,
      onesErrorCode: error.code,
      onesErrorData: error.data
    };
  }

  return {
    error: error instanceof Error ? error.message : String(error)
  };
}

function buildPrepareExecuteResultErrorContext(
  error: unknown
): Record<string, unknown> {
  const preparedError = findNestedError(
    error,
    (candidate): candidate is PrepareExecuteResultError =>
      candidate instanceof PrepareExecuteResultError
  );
  const requestError = findNestedError(
    error,
    (candidate): candidate is OnesRequestError =>
      candidate instanceof OnesRequestError
  );
  const responseError = findNestedError(
    error,
    (candidate): candidate is OnesResponseError =>
      candidate instanceof OnesResponseError
  );

  return {
    error: error instanceof Error ? error.message : String(error),
    preparePhase: preparedError?.context.phase,
    outputAlias: preparedError?.context.outputAlias,
    fieldUUID: preparedError?.context.fieldUUID,
    fieldValueType: preparedError?.context.fieldValueType,
    rawValueSummary: preparedError?.context.rawValueSummary,
    referenceName: preparedError?.context.referenceName,
    referenceMode: preparedError?.context.referenceMode,
    onesStatus: requestError?.status,
    onesUrl: requestError?.url,
    onesResponseBody: summarizeForLog(requestError?.responseBody),
    onesErrorCode: responseError?.code,
    onesErrorData: responseError?.data
  };
}

function mergeLogHistory(existingLogs: string, incomingLogs: string): string {
  const trimmedExistingLogs = existingLogs.trim();
  const trimmedIncomingLogs = incomingLogs.trim();

  if (!trimmedExistingLogs) {
    return incomingLogs;
  }

  if (!trimmedIncomingLogs) {
    return existingLogs;
  }

  if (trimmedExistingLogs === trimmedIncomingLogs) {
    return existingLogs;
  }

  if (trimmedIncomingLogs.includes(trimmedExistingLogs)) {
    return incomingLogs;
  }

  if (trimmedExistingLogs.includes(trimmedIncomingLogs)) {
    return existingLogs;
  }

  return `${existingLogs.trimEnd()}\n\n${incomingLogs}`;
}

async function parseTaskExecuteResult(
  task: IssueAgentExecutionHistoryWithExecutionRecord,
  executeResult: string,
  agentConfigCache: AgentConfigCache,
  teamUUID: string
): Promise<ParsedTaskExecuteResult> {
  const agentConfig = await loadAgentConfig(
    task.agentUUID,
    task.agentVersion,
    agentConfigCache,
    teamUUID
  );

  if (!agentConfig) {
    throw new Error(
      `Missing agent config for ${task.agentUUID}@${task.agentVersion}`
    );
  }

  try {
    let revisionSummary: ParsedAgentRevisionSummary | null = null;
    let revisionSummaryWarning: string | undefined;

    try {
      revisionSummary = parseAgentRevisionSummary(executeResult);
    } catch (error) {
      revisionSummaryWarning =
        error instanceof Error ? error.message : String(error);
    }

    return {
      outputs: parseAgentOutputString(
        executeResult,
        agentConfig.outputs
      ) as ParsedAgentOutputItem[],
      revisionSummary,
      ...(revisionSummaryWarning ? { revisionSummaryWarning } : {})
    };
  } catch (error) {
    throw withPrepareExecuteResultContext(error, {
      phase: 'parse_execute_result',
      rawValueSummary: summarizeForLog(executeResult)
    });
  }
}

function getAgentOutputFieldUUIDPath(output: AgentOutputField): string {
  return output.field.uuid;
}

function getAgentOutputSetValueEntryPath(
  fieldChain: AgentOutputSetValueField[]
) {
  return fieldChain.map((field) => field.field.uuid).join('.');
}

function getAgentOutputSetValueEntries(field: AgentOutputSetValueField) {
  function visit(
    currentField: AgentOutputSetValueField,
    fieldChain: AgentOutputSetValueField[]
  ): Array<{
    fieldUUIDPath: string;
    fieldChain: AgentOutputSetValueField[];
    leafField: AgentOutputSetValueField;
  }> {
    if (currentField.subFields.length === 0) {
      return [
        {
          fieldUUIDPath: getAgentOutputSetValueEntryPath(fieldChain),
          fieldChain,
          leafField: currentField
        }
      ];
    }

    return currentField.subFields.flatMap((subField) =>
      visit(subField, [...fieldChain, subField])
    );
  }

  return visit(field, [field]);
}

function splitDisplayIdFieldValue(fieldValues: CreateIssueFieldValue[]): {
  displayId: string | null;
  fieldValues: CreateIssueFieldValue[];
} {
  let displayId: string | null = null;
  const nextFieldValues: CreateIssueFieldValue[] = [];

  for (const fieldValue of fieldValues) {
    if (fieldValue.fieldUUID !== ISSUE_DISPLAY_ID_FIELD_UUID) {
      nextFieldValues.push(fieldValue);
      continue;
    }

    const normalizedDisplayId = String(fieldValue.value ?? '').trim();

    if (normalizedDisplayId) {
      displayId = normalizedDisplayId;
    }
  }

  return {
    displayId,
    fieldValues: nextFieldValues
  };
}

async function buildRefObjectLinkFieldValue(
  targetIssueUUID: string,
  targetFieldUUID: string,
  targetFieldValueType: 'single_reference_object' | 'multi_reference_object',
  linkedIssueUUID: string,
  onesContext: OnesOpenApiContext
): Promise<unknown> {
  if (targetFieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE) {
    return linkedIssueUUID;
  }

  const existingFieldValues = await getIssueFieldValues(
    targetIssueUUID,
    [
      {
        uuid: targetFieldUUID,
        alias: targetFieldUUID,
        valueType: MULTI_REFERENCE_OBJECT_VALUE_TYPE
      }
    ],
    onesContext
  );

  if (!existingFieldValues) {
    throw new Error(
      `ONES issue not found when appending linked ref object: ${targetIssueUUID}`
    );
  }

  return Array.from(
    new Set([
      ...toIssueRefList(existingFieldValues[targetFieldUUID]).map(
        (refObject) => refObject.uuid
      ),
      linkedIssueUUID
    ])
  );
}

async function buildIssueReferenceFieldValue(
  targetIssueUUID: string,
  targetFieldUUID: string,
  targetFieldValueType: 'single_reference_object' | 'multi_reference_object',
  linkedIssueUUIDs: string[],
  fieldWriteMode: ReferenceFieldWriteMode,
  onesContext: OnesOpenApiContext
): Promise<unknown> {
  const normalizedUUIDs = Array.from(
    new Set(linkedIssueUUIDs.map((uuid) => uuid.trim()).filter(Boolean))
  );

  if (targetFieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE) {
    return normalizedUUIDs[0] ?? '';
  }

  if (fieldWriteMode !== 'append') {
    return normalizedUUIDs;
  }

  const existingFieldValues = await getIssueFieldValues(
    targetIssueUUID,
    [
      {
        uuid: targetFieldUUID,
        alias: targetFieldUUID,
        valueType: MULTI_REFERENCE_OBJECT_VALUE_TYPE
      }
    ],
    onesContext
  );

  if (!existingFieldValues) {
    throw new Error(
      `ONES issue not found when building ref object value: ${targetIssueUUID}`
    );
  }

  return Array.from(
    new Set([
      ...toIssueRefList(existingFieldValues[targetFieldUUID]).map(
        (refObject) => refObject.uuid
      ),
      ...normalizedUUIDs
    ])
  );
}

async function buildOutputFieldValueForWrite(
  issueUUID: string,
  field: FieldValueMetadata,
  rawValue: unknown,
  fieldWriteMode: ReferenceFieldWriteMode,
  onesContext: OnesOpenApiContext
): Promise<unknown> {
  const resolvedValue = await toIssueOutputFieldValue(
    field,
    rawValue,
    onesContext
  );

  if (
    field.fieldValueType !== MULTI_REFERENCE_OBJECT_VALUE_TYPE ||
    fieldWriteMode !== 'append'
  ) {
    return resolvedValue;
  }

  const existingFieldValues = await getIssueFieldValues(
    issueUUID,
    [
      {
        uuid: field.fieldUUID,
        alias: field.fieldUUID,
        valueType: MULTI_REFERENCE_OBJECT_VALUE_TYPE,
        referenceObjectType: field.fieldReferenceObjectType
      }
    ],
    onesContext
  );

  if (!existingFieldValues) {
    throw new Error(
      `ONES issue not found when appending output field value: ${issueUUID}`
    );
  }

  const resolvedItems = Array.isArray(resolvedValue)
    ? resolvedValue
    : resolvedValue === null ||
        resolvedValue === undefined ||
        resolvedValue === ''
      ? []
      : [resolvedValue];

  return Array.from(
    new Set([
      ...toIssueRefList(existingFieldValues[field.fieldUUID]).map(
        (refObject) => refObject.uuid
      ),
      ...resolvedItems.map((item) => String(item).trim()).filter(Boolean)
    ])
  );
}

function toFieldValueMetadata(field: {
  fieldUUID: string;
  fieldName: string;
  fieldValueType: string;
  fieldReferenceObjectType: string | null;
}) {
  return field;
}

function getIssueReferenceFieldValueType(
  valueType: string
): 'single_reference_object' | 'multi_reference_object' {
  if (
    valueType !== SINGLE_REFERENCE_OBJECT_VALUE_TYPE &&
    valueType !== MULTI_REFERENCE_OBJECT_VALUE_TYPE
  ) {
    throw new Error(
      `Unsupported issue reference field value type: ${valueType}`
    );
  }

  return valueType;
}

function isObjectOutputField(field: AgentOutputField): boolean {
  return (
    field.field.valueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE ||
    field.field.valueType === MULTI_REFERENCE_OBJECT_VALUE_TYPE ||
    isCommentField(field.field.uuid)
  );
}

function getAttachmentOutputLocalPath(
  outputFieldUUIDPath: string,
  objectValue: ParsedAgentOutputObject
): string {
  if (
    objectValue.objectType.trim() &&
    objectValue.objectType.trim() !== ATTACHMENT_OBJECT_TYPE
  ) {
    throw new Error(
      `Output "${outputFieldUUIDPath}" expects object-type "${ATTACHMENT_OBJECT_TYPE}"`
    );
  }

  if (objectValue.objectWriteMode && objectValue.objectWriteMode !== 'create') {
    throw new Error(
      `Output "${outputFieldUUIDPath}" attachment objects only support object-write-mode=create`
    );
  }

  const localPath = objectValue.fields[ATTACHMENT_LOCAL_PATH_FIELD_UUID];

  if (typeof localPath !== 'string' || !localPath.trim()) {
    throw new Error(
      `Output "${outputFieldUUIDPath}" attachment objects require child field "${ATTACHMENT_LOCAL_PATH_FIELD_UUID}"`
    );
  }

  return localPath.trim();
}

function hasAttachmentOutputLocalPath(
  objectValue: ParsedAgentOutputObject
): boolean {
  return (
    typeof objectValue.fields[ATTACHMENT_LOCAL_PATH_FIELD_UUID] === 'string'
  );
}

function getCommentOutputText(
  outputFieldUUIDPath: string,
  objectValue: ParsedAgentOutputObject
): string {
  if (
    objectValue.objectType.trim() &&
    objectValue.objectType.trim() !== COMMENT_OBJECT_TYPE
  ) {
    throw new Error(
      `Output "${outputFieldUUIDPath}" expects object-type "${COMMENT_OBJECT_TYPE}"`
    );
  }

  if (objectValue.objectWriteMode && objectValue.objectWriteMode !== 'create') {
    throw new Error(
      `Output "${outputFieldUUIDPath}" comment objects only support object-write-mode=create`
    );
  }

  const content = objectValue.fields[COMMENT_CONTENT_FIELD_UUID];

  if (typeof content !== 'string') {
    throw new Error(
      `Output "${outputFieldUUIDPath}" comment objects require child field "${COMMENT_CONTENT_FIELD_UUID}"`
    );
  }

  return content;
}

async function resolveOutputTargetIssueUUID(
  issueUUID: string,
  fieldChain: AgentOutputSetValueField[],
  onesContext: OnesOpenApiContext,
  cache: Map<string, unknown>
): Promise<string> {
  let currentIssueUUID = issueUUID;

  for (const field of fieldChain.slice(0, -1)) {
    const rootValue = await loadIssueFieldValue(
      currentIssueUUID,
      {
        uuid: field.field.uuid,
        valueType: field.field.valueType,
        referenceObjectType: field.field.referenceObjectType ?? null
      },
      onesContext,
      cache
    );

    if (!isRefObject(rootValue)) {
      throw new Error(
        `Output field "${getAgentOutputSetValueEntryPath(fieldChain)}" requires a single issue reference target`
      );
    }

    currentIssueUUID = rootValue.uuid;
  }

  return currentIssueUUID;
}

async function buildIssueObjectFieldValues(
  output: AgentOutputField,
  objectValue: ParsedAgentOutputObject,
  outputFieldUUIDPath: string,
  attachmentUploadsByOutputName: Map<string, AttachmentUpload[]>,
  onesContext: OnesOpenApiContext
): Promise<{
  fieldValues: CreateIssueFieldValue[];
  deferredIssueAttachmentFieldWrites: Omit<
    DeferredIssueAttachmentFieldWrite,
    'targetIssueUUID' | 'createPlanIndex'
  >[];
}> {
  const configuredSubFields = new Map(
    output.subFields.map((subField) => [subField.field.uuid, subField] as const)
  );
  const fieldValues: CreateIssueFieldValue[] = [];
  const deferredIssueAttachmentFieldWrites: Omit<
    DeferredIssueAttachmentFieldWrite,
    'targetIssueUUID' | 'createPlanIndex'
  >[] = [];

  await Promise.all(
    Object.entries(objectValue.fields).map(async ([fieldUUID, rawValue]) => {
      const subField = configuredSubFields.get(fieldUUID);

      if (!subField) {
        throw new Error(
          `Unknown child field "${fieldUUID}" for output "${outputFieldUUIDPath}"`
        );
      }

      const targetField = toFieldValueMetadata({
        fieldUUID: subField.field.uuid,
        fieldName: subField.field.name,
        fieldValueType: subField.field.valueType,
        fieldReferenceObjectType: subField.field.referenceObjectType
      });

      if (
        targetField.fieldUUID === ISSUE_STATUS_FIELD_UUID ||
        isCommentField(targetField.fieldUUID)
      ) {
        throw new Error(
          `Child field "${targetField.fieldUUID}" uses unsupported ONES field`
        );
      }

      if (
        isAttachmentField(targetField) &&
        isParsedObjectFieldValueArray(rawValue)
      ) {
        const uploadObjects = rawValue.filter((item) =>
          hasAttachmentOutputLocalPath(item)
        );
        const referenceObjects = rawValue.filter(
          (item) => !hasAttachmentOutputLocalPath(item)
        );
        const referenceValue =
          referenceObjects.length > 0
            ? await toIssueOutputFieldValue(
                targetField,
                referenceObjects,
                onesContext
              )
            : targetField.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE
              ? ''
              : [];
        const existingAttachmentUUIDs = toReferenceUUIDList(referenceValue);

        if (existingAttachmentUUIDs.length > 0) {
          fieldValues.push({
            fieldUUID: subField.field.uuid,
            value: referenceValue
          });
        }

        if (uploadObjects.length > 0) {
          const attachmentOutputName = buildAttachmentUploadOutputName(
            outputFieldUUIDPath,
            targetField.fieldUUID
          );
          const declaredLocalPaths = uploadObjects.map((item) =>
            getAttachmentOutputLocalPath(attachmentOutputName, item)
          );
          const uploads = consumeAttachmentUploadsForOutput(
            attachmentOutputName,
            declaredLocalPaths,
            attachmentUploadsByOutputName
          );

          deferredIssueAttachmentFieldWrites.push({
            outputFieldUUIDPath: attachmentOutputName,
            targetFieldUUID: targetField.fieldUUID,
            targetFieldValueType: getIssueReferenceFieldValueType(
              targetField.fieldValueType
            ),
            existingAttachmentUUIDs,
            uploads
          });
        }

        return;
      }

      fieldValues.push({
        fieldUUID: subField.field.uuid,
        value: await toIssueOutputFieldValue(targetField, rawValue, onesContext)
      });
    })
  );

  return {
    fieldValues,
    deferredIssueAttachmentFieldWrites
  };
}

export async function buildIssueOutputWritePlan(
  task: Pick<
    IssueAgentExecutionHistoryWithExecutionRecord,
    'agentUUID' | 'agentVersion' | 'executeOption' | 'issueExecution'
  >,
  executeResults: ParsedTaskExecuteResult['outputs'],
  attachmentUploads: AgentClientTaskReport['attachmentUploads'],
  agentConfigCache: AgentConfigCache,
  teamUUID: string,
  onesContext: OnesOpenApiContext
): Promise<OutputWritePlan> {
  const agentConfig = await loadAgentConfig(
    task.agentUUID,
    task.agentVersion,
    agentConfigCache,
    teamUUID
  );

  if (!agentConfig) {
    throw new Error(
      `Missing agent config for ${task.agentUUID}@${task.agentVersion}`
    );
  }

  if (agentConfig.outputs.length === 0) {
    return {
      createRefObjectPlans: [],
      deferredIssueReferenceWrites: [],
      deferredIssueAttachmentFieldWrites: [],
      issueFieldValues: [],
      issueComments: [],
      issueAttachments: [],
      statusFieldValues: [],
      wikiWrites: []
    };
  }

  const parsedOutputsByFieldUUIDPath = new Map(
    executeResults.map((output) => [output.fieldUUIDPath, output] as const)
  );
  const attachmentUploadsByOutputName = new Map<string, AttachmentUpload[]>(
    normalizeAttachmentOutputRecords(
      attachmentUploads ?? getTaskAttachmentUploads(task.executeOption)
    ).map((attachmentOutput) => [
      attachmentOutput.outputName,
      attachmentOutput.uploads
    ])
  );

  const issueFieldValues: ScopedIssueFieldValue[] = [];
  const issueComments: ScopedIssueComment[] = [];
  const issueAttachments: ScopedIssueAttachment[] = [];
  const statusFieldValues: ScopedStatusFieldValue[] = [];
  const createRefObjectPlans: CreateRefObjectPlan[] = [];
  const deferredIssueReferenceWrites: DeferredIssueReferenceWrite[] = [];
  const deferredIssueAttachmentFieldWrites: DeferredIssueAttachmentFieldWrite[] =
    [];
  const wikiWrites: WikiWritePlan[] = [];

  for (const output of agentConfig.outputs) {
    let currentOutputAlias = getAgentOutputFieldUUIDPath(output);
    let currentParsedOutput: ParsedAgentOutputItem | null = null;
    const outputFieldUUIDPath = getAgentOutputFieldUUIDPath(output);
    const parsedOutput = parsedOutputsByFieldUUIDPath.get(outputFieldUUIDPath);
    currentOutputAlias = outputFieldUUIDPath;

    try {
      if (!parsedOutput) {
        throw new Error(
          `Missing execute result for output "${outputFieldUUIDPath}"`
        );
      }

      currentParsedOutput = parsedOutput;

      if (output.kind === 'wiki_page') {
        if (parsedOutput.mode !== 'wiki_page') {
          throw new Error(
            `Output "${outputFieldUUIDPath}" must use <wiki-action>`
          );
        }

        wikiWrites.push(
          await buildWikiWritePlan({
            output: parsedOutput,
            field: output,
            executeOption: task.executeOption,
            knowledgeSourceUUIDs: agentConfig.knowledgeSourceUUIDs,
            onesContext
          })
        );
        continue;
      }

      const targetField = toFieldValueMetadata({
        fieldUUID: output.field.uuid,
        fieldName: output.field.name,
        fieldValueType: output.field.valueType,
        fieldReferenceObjectType: output.field.referenceObjectType ?? null
      });

      if (!isObjectOutputField(output)) {
        if (parsedOutput.mode !== 'set_value') {
          throw new Error(
            `Output "${outputFieldUUIDPath}" must use <set-value>`
          );
        }

        const rawValue = (parsedOutput as ParsedAgentSetValueOutput).value;

        if (targetField.fieldUUID === ISSUE_STATUS_FIELD_UUID) {
          statusFieldValues.push({
            issueUUID: task.issueExecution.dispatchedIssueUUID,
            fieldUUID: targetField.fieldUUID,
            value: {
              uuid: null,
              name: String(rawValue ?? '').trim() || null
            },
            outputFieldUUIDPath
          });
          continue;
        }

        if (isCommentField(targetField.fieldUUID)) {
          issueComments.push({
            issueUUID: task.issueExecution.dispatchedIssueUUID,
            text: String(rawValue ?? ''),
            outputFieldUUIDPath
          });
          continue;
        }

        issueFieldValues.push({
          issueUUID: task.issueExecution.dispatchedIssueUUID,
          fieldUUID: targetField.fieldUUID,
          value: await buildOutputFieldValueForWrite(
            task.issueExecution.dispatchedIssueUUID,
            targetField,
            rawValue,
            'set',
            onesContext
          ),
          outputFieldUUIDPath
        });
        continue;
      }

      if (parsedOutput.mode !== 'object_values') {
        throw new Error(`Output "${outputFieldUUIDPath}" must use <objects>`);
      }

      if (parsedOutput.objects.length === 0) {
        continue;
      }

      if (
        targetField.fieldUUID === ISSUE_STATUS_FIELD_UUID &&
        targetField.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE
      ) {
        const statusObject = parsedOutput.objects[0] ?? null;

        statusFieldValues.push({
          issueUUID: task.issueExecution.dispatchedIssueUUID,
          fieldUUID: targetField.fieldUUID,
          value: {
            uuid: statusObject?.objectUUID?.trim() || null,
            name: statusObject?.objectName?.trim() || null
          },
          outputFieldUUIDPath
        });
        continue;
      }

      if (isCommentOutputField(targetField)) {
        for (const objectValue of parsedOutput.objects) {
          issueComments.push({
            issueUUID: task.issueExecution.dispatchedIssueUUID,
            text: getCommentOutputText(outputFieldUUIDPath, objectValue),
            outputFieldUUIDPath
          });
        }

        continue;
      }

      if (isAttachmentOutputField(targetField)) {
        const uploadObjects = parsedOutput.objects.filter((objectValue) =>
          hasAttachmentOutputLocalPath(objectValue)
        );
        const referenceObjects = parsedOutput.objects.filter(
          (objectValue) => !hasAttachmentOutputLocalPath(objectValue)
        );
        const declaredLocalPaths = uploadObjects.map((objectValue) =>
          getAttachmentOutputLocalPath(outputFieldUUIDPath, objectValue)
        );
        const uploads = consumeAttachmentUploadsForOutput(
          outputFieldUUIDPath,
          declaredLocalPaths,
          attachmentUploadsByOutputName
        );

        if (uploads.length > 0) {
          issueAttachments.push({
            issueUUID: task.issueExecution.dispatchedIssueUUID,
            outputFieldUUIDPath,
            uploads
          });
        }

        if (referenceObjects.length > 0) {
          issueFieldValues.push({
            issueUUID: task.issueExecution.dispatchedIssueUUID,
            fieldUUID: targetField.fieldUUID,
            value: await buildOutputFieldValueForWrite(
              task.issueExecution.dispatchedIssueUUID,
              targetField,
              referenceObjects,
              'set',
              onesContext
            ),
            outputFieldUUIDPath
          });
        }

        continue;
      }

      if (
        targetField.fieldReferenceObjectType !== 'issue' ||
        output.subFields.length === 0
      ) {
        issueFieldValues.push({
          issueUUID: task.issueExecution.dispatchedIssueUUID,
          fieldUUID: targetField.fieldUUID,
          value: await buildOutputFieldValueForWrite(
            task.issueExecution.dispatchedIssueUUID,
            targetField,
            parsedOutput.objects,
            getReferenceFieldWriteMode(parsedOutput),
            onesContext
          ),
          outputFieldUUIDPath
        });
        continue;
      }

      const updatedIssueUUIDs: string[] = [];
      const fieldWriteMode = getReferenceFieldWriteMode(parsedOutput);
      const revisionTargetIssueUUIDs = getRevisionCurrentOutputRefUUIDs(
        task.executeOption,
        output.field.uuid
      );

      if (
        revisionTargetIssueUUIDs.length > 0 &&
        parsedOutput.objects.some(
          (objectValue) => objectValue.objectWriteMode === 'create'
        )
      ) {
        throw new Error(
          `Revision output "${outputFieldUUIDPath}" must update an existing issue instead of creating a duplicate`
        );
      }

      for (const objectValue of parsedOutput.objects) {
        if (
          objectValue.objectWriteMode !== 'create' &&
          objectValue.objectWriteMode !== 'update'
        ) {
          throw new Error(
            `Output "${outputFieldUUIDPath}" requires object-write-mode to be create or update`
          );
        }

        const {
          fieldValues,
          deferredIssueAttachmentFieldWrites: childAttachmentFieldWrites
        } = await buildIssueObjectFieldValues(
          output,
          objectValue,
          outputFieldUUIDPath,
          attachmentUploadsByOutputName,
          onesContext
        );

        if (objectValue.objectWriteMode === 'update') {
          const targetIssueUUID = objectValue.objectUUID?.trim();

          if (!targetIssueUUID) {
            throw new Error(
              `Output "${outputFieldUUIDPath}" update object requires object-uuid`
            );
          }

          if (
            revisionTargetIssueUUIDs.length > 0 &&
            !revisionTargetIssueUUIDs.includes(targetIssueUUID)
          ) {
            throw new Error(
              `Revision output "${outputFieldUUIDPath}" can only update issues linked by an earlier round`
            );
          }

          updatedIssueUUIDs.push(targetIssueUUID);

          for (const fieldValue of fieldValues) {
            issueFieldValues.push({
              issueUUID: targetIssueUUID,
              fieldUUID: fieldValue.fieldUUID,
              value: fieldValue.value,
              outputFieldUUIDPath
            });
          }

          for (const attachmentFieldWrite of childAttachmentFieldWrites) {
            deferredIssueAttachmentFieldWrites.push({
              ...attachmentFieldWrite,
              targetIssueUUID
            });
          }

          continue;
        }

        const createPlanIndex = createRefObjectPlans.length;
        createRefObjectPlans.push({
          outputFieldUUIDPath,
          targetIssueUUID: task.issueExecution.dispatchedIssueUUID,
          targetFieldUUID: output.field.uuid,
          targetFieldValueType: getIssueReferenceFieldValueType(
            output.field.valueType
          ),
          fieldWriteMode,
          fieldValues
        });

        for (const attachmentFieldWrite of childAttachmentFieldWrites) {
          deferredIssueAttachmentFieldWrites.push({
            ...attachmentFieldWrite,
            createPlanIndex
          });
        }
      }

      if (
        updatedIssueUUIDs.length > 0 ||
        parsedOutput.objects.length > 0 ||
        fieldWriteMode === 'set'
      ) {
        deferredIssueReferenceWrites.push({
          outputFieldUUIDPath,
          targetIssueUUID: task.issueExecution.dispatchedIssueUUID,
          targetFieldUUID: output.field.uuid,
          targetFieldValueType: getIssueReferenceFieldValueType(
            output.field.valueType
          ),
          fieldWriteMode,
          updatedIssueUUIDs
        });
      }
    } catch (error) {
      throw withPrepareExecuteResultContext(error, {
        phase:
          output.subFields.length > 0
            ? 'build_create_issue_plan'
            : 'build_output_write_plan',
        outputAlias: currentOutputAlias,
        fieldUUID: output.field.uuid,
        fieldValueType: output.field.valueType,
        rawValueSummary: summarizeUnknownForLog(
          currentParsedOutput
            ? currentParsedOutput.mode === 'set_value'
              ? currentParsedOutput.value
              : currentParsedOutput.mode === 'object_values'
                ? currentParsedOutput.objects
                : {
                    action: currentParsedOutput.action,
                    targetPageUUID: currentParsedOutput.targetPageUUID,
                    targetPageName: currentParsedOutput.targetPageName,
                    parentPageUUID: currentParsedOutput.parentPageUUID,
                    spaceUUID: currentParsedOutput.spaceUUID,
                    configuredWriteSpaceUUID:
                      output.kind === 'wiki_page'
                        ? (output.writeTarget?.spaceUUID ?? null)
                        : null
                  }
            : null
        )
      });
    }
  }

  for (const [outputName, uploads] of attachmentUploadsByOutputName.entries()) {
    if (uploads.length > 0) {
      throw new Error(
        `Attachment output "${outputName}" reported ${uploads.length} unused upload(s)`
      );
    }
  }

  return {
    createRefObjectPlans,
    deferredIssueReferenceWrites,
    deferredIssueAttachmentFieldWrites,
    issueFieldValues,
    issueComments,
    issueAttachments,
    statusFieldValues,
    wikiWrites
  };
}

function parseReferenceNames(rawValue: unknown): string[] {
  const stringValue =
    typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');

  return Array.from(
    new Set(
      stringValue
        .split(/[\n,，;；]+/u)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeReferenceCandidateName(value: string): string {
  return value.replace(/\s+/gu, '').toLowerCase();
}

function extractExplicitReferenceUUID(value: string): string | null {
  const match = value.match(/\[uuid=([^\]]+)\]/i);
  const normalizedUUID = match?.[1]?.trim();
  return normalizedUUID ? normalizedUUID : null;
}

function normalizeFieldTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s()（）_\[\]-]+/gu, '');
}

function extractFieldOptionDisplayNameFromValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }

  const record = value as Record<string, unknown>;

  for (const key of ['name', 'label', 'text', 'title', 'value']) {
    const candidate = extractFieldOptionDisplayNameFromValue(record[key]);

    if (candidate) {
      return candidate;
    }
  }

  return '';
}

function extractFieldOptionDisplayName(
  option: Record<string, unknown>
): string {
  return extractFieldOptionDisplayNameFromValue(option);
}

export function findExactFieldOptionMatches<T extends Record<string, unknown>>(
  options: readonly T[],
  value: string
): T[] {
  const normalizedInput = normalizeReferenceCandidateName(value);

  return options.filter((option) => {
    const displayName = extractFieldOptionDisplayName(option);

    return (
      displayName.length > 0 &&
      normalizeReferenceCandidateName(displayName) === normalizedInput
    );
  });
}

function extractUserCandidateNames(user: {
  name: string;
  email?: string;
  staffID?: string;
}): string[] {
  return [user.name, user.email, user.staffID].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );
}

function formatUserCandidate(user: {
  name: string;
  email?: string;
  staffID?: string;
}): string {
  const parts = [user.name];

  if (user.email?.trim()) {
    parts.push(`<${user.email.trim()}>`);
  }

  if (user.staffID?.trim()) {
    parts.push(`[staffID=${user.staffID.trim()}]`);
  }

  return parts.join(' ');
}

export function findExactUserMatches<
  T extends {
    name: string;
    email?: string;
    staffID?: string;
  }
>(users: readonly T[], value: string): T[] {
  const normalizedInput = normalizeReferenceCandidateName(value);

  return users.filter((user) =>
    extractUserCandidateNames(user).some(
      (candidate) =>
        normalizeReferenceCandidateName(candidate) === normalizedInput
    )
  );
}

type FieldValueMetadata = {
  fieldUUID: string;
  fieldName: string;
  fieldValueType: string;
  fieldReferenceObjectType: string | null;
};

export function isUserReferenceField(field: FieldValueMetadata): boolean {
  if (
    field.fieldValueType !== SINGLE_REFERENCE_OBJECT_VALUE_TYPE &&
    field.fieldValueType !== MULTI_REFERENCE_OBJECT_VALUE_TYPE
  ) {
    return false;
  }

  if (field.fieldUUID === ISSUE_ASSIGNEE_FIELD_UUID) {
    return true;
  }

  return field.fieldReferenceObjectType === 'user';
}

function isIssueReferenceField(field: FieldValueMetadata): boolean {
  return (
    (field.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE ||
      field.fieldValueType === MULTI_REFERENCE_OBJECT_VALUE_TYPE) &&
    field.fieldReferenceObjectType === 'issue'
  );
}

function isParsedObjectFieldValueArray(
  value: unknown
): value is ParsedAgentOutputObject[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.objectType === 'string' &&
        'fields' in item
    )
  );
}

async function resolveIssueReferenceObject(
  field: FieldValueMetadata,
  objectValue: ParsedAgentOutputObject,
  onesContext: OnesOpenApiContext
): Promise<string> {
  const explicitUUID = objectValue.objectUUID?.trim();

  if (explicitUUID) {
    return explicitUUID;
  }

  const objectName = objectValue.objectName?.trim();

  if (!objectName) {
    throw new Error(
      `Output field "${field.fieldName}" requires object-uuid or object-name`
    );
  }

  const issue = await findIssueByDisplayId(onesContext, objectName);

  if (!issue) {
    throw new Error(
      `Output field "${field.fieldName}" cannot resolve issue "${objectName}"`
    );
  }

  return issue.uuid;
}

async function resolveReferenceFieldObjectUUID(
  field: FieldValueMetadata,
  objectValue: ParsedAgentOutputObject,
  onesContext: OnesOpenApiContext
): Promise<string> {
  const explicitUUID = objectValue.objectUUID?.trim();

  if (explicitUUID) {
    return explicitUUID;
  }

  const objectName = objectValue.objectName?.trim();

  if (!objectName) {
    throw new Error(
      `Output field "${field.fieldName}" requires object-uuid or object-name`
    );
  }

  if (isIssueReferenceField(field)) {
    return resolveIssueReferenceObject(field, objectValue, onesContext);
  }

  if (isUserReferenceField(field)) {
    let users;

    try {
      users = await searchIssueUsers(
        {
          keyword: objectName,
          limit: 50
        },
        onesContext
      );
    } catch (error) {
      throw withPrepareExecuteResultContext(error, {
        referenceName: objectName,
        referenceMode: 'search_users'
      });
    }

    const exactMatches = findExactUserMatches(users, objectName);

    if (exactMatches.length === 0) {
      const candidateNames = users.map((user) => formatUserCandidate(user));

      throw new Error(
        `Output field "${field.fieldName}" cannot resolve user "${objectName}"${
          candidateNames.length > 0
            ? `, candidates: ${candidateNames.join(', ')}`
            : ''
        }`
      );
    }

    if (exactMatches.length > 1) {
      throw new Error(
        `Output field "${field.fieldName}" resolved user "${objectName}" to multiple candidates: ${exactMatches
          .map((user) => formatUserCandidate(user))
          .join(', ')}`
      );
    }

    return exactMatches[0].id;
  }

  let options;

  try {
    options = await listIssueFieldOptions(
      {
        fieldUUID: field.fieldUUID,
        keyword: objectName,
        limit: 50,
        offset: 0,
        includeFields: ['uuid', 'name', 'value', 'label', 'text', 'title']
      },
      onesContext
    );
  } catch (error) {
    throw withPrepareExecuteResultContext(error, {
      referenceName: objectName,
      referenceMode: 'list_field_options'
    });
  }

  const exactMatches = findExactFieldOptionMatches(options, objectName);

  if (exactMatches.length === 0) {
    const candidateNames = options
      .map((option) => extractFieldOptionDisplayName(option))
      .filter(Boolean);

    throw new Error(
      `Output field "${field.fieldName}" cannot resolve reference "${objectName}"${
        candidateNames.length > 0
          ? `, candidates: ${candidateNames.join(', ')}`
          : ''
      }`
    );
  }

  if (exactMatches.length > 1) {
    throw new Error(
      `Output field "${field.fieldName}" resolved reference "${objectName}" to multiple candidates: ${exactMatches
        .map((option) => extractFieldOptionDisplayName(option))
        .join(', ')}`
    );
  }

  return String(exactMatches[0].uuid ?? '').trim();
}

async function resolveReferenceFieldValue(
  field: FieldValueMetadata,
  rawValue: unknown,
  onesContext: OnesOpenApiContext
): Promise<unknown> {
  if (isParsedObjectFieldValueArray(rawValue)) {
    if (
      field.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE &&
      rawValue.length > 1
    ) {
      throw new Error(
        `Output field "${field.fieldName}" expects a single reference object`
      );
    }

    const resolvedItems = await Promise.all(
      rawValue.map((objectValue) =>
        resolveReferenceFieldObjectUUID(field, objectValue, onesContext)
      )
    );

    if (field.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE) {
      return resolvedItems[0] ?? '';
    }

    return resolvedItems;
  }

  const names = parseReferenceNames(rawValue);

  if (field.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE) {
    if (names.length === 0) {
      return '';
    }

    if (names.length > 1) {
      throw new Error(
        `Output field "${field.fieldName}" expects a single reference value, received "${names.join(', ')}"`
      );
    }
  }

  if (
    field.fieldValueType === MULTI_REFERENCE_OBJECT_VALUE_TYPE &&
    names.length === 0
  ) {
    return [];
  }

  const resolvedItems = await Promise.all(
    names.map(async (name) => {
      const explicitUUID = extractExplicitReferenceUUID(name);

      if (explicitUUID) {
        return explicitUUID;
      }

      if (isUserReferenceField(field)) {
        let users;

        try {
          users = await searchIssueUsers(
            {
              keyword: name,
              limit: 50
            },
            onesContext
          );
        } catch (error) {
          throw withPrepareExecuteResultContext(error, {
            referenceName: name,
            referenceMode: 'search_users'
          });
        }
        const exactMatches = findExactUserMatches(users, name);

        if (exactMatches.length === 0) {
          const candidateNames = users.map((user) => formatUserCandidate(user));

          throw new Error(
            `Output field "${field.fieldName}" cannot resolve user "${name}"${
              candidateNames.length > 0
                ? `, candidates: ${candidateNames.join(', ')}`
                : ''
            }`
          );
        }

        if (exactMatches.length > 1) {
          throw new Error(
            `Output field "${field.fieldName}" resolved user "${name}" to multiple candidates: ${exactMatches
              .map((user) => formatUserCandidate(user))
              .join(', ')}`
          );
        }

        return exactMatches[0].id;
      }

      let options;

      try {
        options = await listIssueFieldOptions(
          {
            fieldUUID: field.fieldUUID,
            keyword: name,
            limit: 50,
            offset: 0,
            includeFields: ['uuid', 'name', 'value', 'label', 'text', 'title']
          },
          onesContext
        );
      } catch (error) {
        throw withPrepareExecuteResultContext(error, {
          referenceName: name,
          referenceMode: 'list_field_options'
        });
      }
      const exactMatches = findExactFieldOptionMatches(options, name);

      if (exactMatches.length === 0) {
        const candidateNames = options
          .map((option) => extractFieldOptionDisplayName(option))
          .filter(Boolean);

        throw new Error(
          `Output field "${field.fieldName}" cannot resolve reference "${name}"${
            candidateNames.length > 0
              ? `, candidates: ${candidateNames.join(', ')}`
              : ''
          }`
        );
      }

      if (exactMatches.length > 1) {
        throw new Error(
          `Output field "${field.fieldName}" resolved reference "${name}" to multiple candidates: ${exactMatches
            .map((option) => extractFieldOptionDisplayName(option))
            .join(', ')}`
        );
      }

      return exactMatches[0].uuid;
    })
  );

  if (field.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE) {
    return resolvedItems[0] ?? '';
  }

  return resolvedItems;
}

async function toIssueOutputFieldValue(
  field: FieldValueMetadata,
  rawValue: unknown,
  onesContext: OnesOpenApiContext
): Promise<unknown> {
  const stringValue =
    typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');

  if (
    field.fieldValueType === SINGLE_REFERENCE_OBJECT_VALUE_TYPE ||
    field.fieldValueType === MULTI_REFERENCE_OBJECT_VALUE_TYPE
  ) {
    return resolveReferenceFieldValue(field, rawValue, onesContext);
  }

  if (
    field.fieldValueType === 'text' ||
    field.fieldValueType === 'multi_line_text' ||
    field.fieldValueType === 'richtext'
  ) {
    return stringValue;
  }

  if (field.fieldValueType === 'integer') {
    const normalizedValue = stringValue.trim();

    if (!/^-?\d+$/.test(normalizedValue)) {
      throw new Error(
        `Output field "${field.fieldName}" expects integer, received "${stringValue}"`
      );
    }

    return Number.parseInt(normalizedValue, 10);
  }

  if (field.fieldValueType === 'float') {
    const normalizedValue = stringValue.trim();
    const parsedValue = Number(normalizedValue);

    if (!Number.isFinite(parsedValue)) {
      throw new Error(
        `Output field "${field.fieldName}" expects float, received "${stringValue}"`
      );
    }

    return parsedValue;
  }

  throw new Error(
    `Output field "${field.fieldName}" uses unsupported value type "${field.fieldValueType}" for ONES write-back`
  );
}

async function prepareTaskReport(
  report: AgentClientTaskReport,
  client: { uuid: string; name: string },
  agentConfigCache: AgentConfigCache,
  teamUUID: string
): Promise<PreparedTaskReport> {
  const task = await findIssueAgentExecutionHistoryByUUID(
    report.taskUUID,
    teamUUID
  );

  if (!task) {
    throw new InvalidAgentClientTaskReportError(report.taskUUID);
  }

  if (task.status !== 'queued' && task.status !== 'running') {
    throw new InvalidAgentClientTaskReportError(report.taskUUID);
  }

  if (task.executeClientUUID && task.executeClientUUID !== client.uuid) {
    throw new InvalidAgentClientTaskReportError(report.taskUUID);
  }

  let status = report.status;
  let logs = report.logs;
  let executeResult: ParsedTaskExecuteResult = {
    outputs: [],
    revisionSummary: null
  };
  let outputWritePlan: OutputWritePlan = {
    createRefObjectPlans: [],
    deferredIssueReferenceWrites: [],
    deferredIssueAttachmentFieldWrites: [],
    issueFieldValues: [],
    issueComments: [],
    issueAttachments: [],
    statusFieldValues: [],
    wikiWrites: []
  };
  const deterministicValidation = {
    passed: true,
    errors: [] as string[],
    requiresEscalation: false
  };
  const onesContext = getExecutorOnesContext(task, teamUUID);

  if (report.status === 'success') {
    try {
      executeResult = await parseTaskExecuteResult(
        task,
        report.executeResult,
        agentConfigCache,
        teamUUID
      );
      if (executeResult.revisionSummaryWarning) {
        logs = appendLogMessage(
          logs,
          `[system] ignored invalid revision summary: ${executeResult.revisionSummaryWarning}`
        );
      }
      const issueOutputWritePlan = await buildIssueOutputWritePlan(
        task,
        executeResult.outputs,
        report.attachmentUploads,
        agentConfigCache,
        teamUUID,
        onesContext
      );
      outputWritePlan = issueOutputWritePlan;
    } catch (error) {
      logger.error(
        '[agent-client-exchange] failed to prepare execute result for ONES write-back',
        {
          taskUUID: report.taskUUID,
          issueExecutionUUID: task.issueExecutionUUID,
          dispatchedIssueUUID: task.issueExecution.dispatchedIssueUUID,
          agentUUID: task.agentUUID,
          agentVersion: task.agentVersion,
          executorUUID: task.executorUUID,
          clientUUID: client.uuid,
          ...buildPrepareExecuteResultErrorContext(error)
        }
      );
      status = 'failure';
      deterministicValidation.passed = false;
      deterministicValidation.errors.push(
        error instanceof Error ? error.message : String(error)
      );
      deterministicValidation.requiresEscalation =
        isNonRepairableLoopError(error);
      logs = appendLogMessage(
        report.logs,
        buildPrepareExecuteResultFailureMessage(error)
      );
    }
  }

  return {
    taskUUID: task.uuid,
    issueExecutionUUID: task.issueExecutionUUID,
    dispatchedIssueUUID: task.issueExecution.dispatchedIssueUUID,
    workflowNodeUUID: task.issueExecution.workflowNodeUUID,
    executorUUID: task.executorUUID,
    executorName: task.executorName,
    triggerStatusUUID: task.issueExecution.triggerStatusUUID,
    triggerStatusName: task.issueExecution.triggerStatusName,
    triggerAssigneeUUID: task.issueExecution.triggerAssigneeUUID,
    triggerAssigneeName: task.issueExecution.triggerAssigneeName,
    status,
    logs,
    executeResult,
    outputWritePlan,
    deterministicValidation,
    startedAt: report.startedAt ? new Date(report.startedAt) : task.startedAt,
    finishedAt: report.finishedAt
      ? new Date(report.finishedAt)
      : task.finishedAt
  };
}

async function getIssueTriggerSnapshot(
  issueUUID: string,
  onesContext: OnesOpenApiContext
): Promise<IssueTriggerSnapshot> {
  const values = await getIssueFieldValues(
    issueUUID,
    [
      {
        uuid: ISSUE_STATUS_FIELD_UUID,
        alias: 'status',
        valueType: SINGLE_REFERENCE_OBJECT_VALUE_TYPE
      },
      {
        uuid: ISSUE_ASSIGNEE_FIELD_UUID,
        alias: 'assignee',
        valueType: SINGLE_REFERENCE_OBJECT_VALUE_TYPE
      }
    ],
    onesContext
  );

  const status = values?.status;
  const assignee = values?.assignee;

  if (!isRefObject(status) || !isRefObject(assignee)) {
    throw new Error(
      'Failed to read issue trigger snapshot after task execution'
    );
  }

  return {
    statusUUID: status.uuid,
    assigneeUUID: assignee.uuid
  };
}

async function writeTaskOutputsToIssue(
  outputFieldValues: ScopedIssueFieldValue[],
  onesContext: OnesOpenApiContext
): Promise<void> {
  if (outputFieldValues.length === 0) {
    return;
  }

  const scopedFieldValuesByIssueUUID = new Map<
    string,
    ScopedIssueFieldValue[]
  >();

  for (const fieldValue of outputFieldValues) {
    const currentScopedFieldValues =
      scopedFieldValuesByIssueUUID.get(fieldValue.issueUUID) ?? [];
    currentScopedFieldValues.push(fieldValue);
    scopedFieldValuesByIssueUUID.set(
      fieldValue.issueUUID,
      currentScopedFieldValues
    );
  }

  for (const [
    targetIssueUUID,
    scopedFieldValues
  ] of scopedFieldValuesByIssueUUID.entries()) {
    if (scopedFieldValues.length === 0) {
      continue;
    }

    await updateIssueFields(
      targetIssueUUID,
      scopedFieldValues.map((fieldValue) => ({
        fieldID: fieldValue.fieldUUID,
        value: fieldValue.value
      })),
      onesContext
    );
  }
}

async function writeTaskCommentsToIssue(
  issueComments: ScopedIssueComment[],
  onesContext: OnesOpenApiContext
): Promise<void> {
  if (issueComments.length === 0) {
    return;
  }

  for (const issueComment of issueComments) {
    const text = issueComment.text.trim();

    if (!text) {
      continue;
    }

    await sendIssueComment(
      issueComment.issueUUID,
      {
        text
      },
      onesContext
    );
  }
}

async function maybeSendTaskStartedComment(
  task: IssueAgentExecutionHistoryWithExecutionRecord,
  onesContext: OnesOpenApiContext
): Promise<void> {
  await maybeSendTaskLifecycleComment(
    task,
    buildTaskStartedComment(task.agentName),
    'task started',
    onesContext
  );
}

async function maybeSendTaskBlockedComment(
  task: IssueAgentExecutionHistoryWithExecutionRecord,
  onesContext: OnesOpenApiContext
): Promise<void> {
  await maybeSendTaskLifecycleComment(
    task,
    buildTaskBlockedComment(task.agentName),
    'task blocked',
    onesContext
  );
}

async function maybeSendTaskLifecycleComment(
  task: IssueAgentExecutionHistoryWithExecutionRecord,
  text: string,
  commentKind: 'task started' | 'task blocked',
  onesContext: OnesOpenApiContext
): Promise<void> {
  const issueUUID = task.issueExecution.dispatchedIssueUUID;

  let comments: OnesOpenApiIssueComment[];

  try {
    comments = await listIssueComments(
      issueUUID,
      onesContext,
      TASK_STARTED_COMMENT_FETCH_LIMIT
    );
  } catch (error) {
    logger.warn(
      `[agent-client-exchange] failed to inspect issue comments before posting ${commentKind} comment`,
      {
        taskUUID: task.uuid,
        issueExecutionUUID: task.issueExecutionUUID,
        dispatchedIssueUUID: issueUUID,
        agentUUID: task.agentUUID,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    return;
  }

  if (hasTaskCommentSinceQueuedAt(comments, text, task.queuedAt)) {
    return;
  }

  try {
    await sendIssueComment(
      issueUUID,
      {
        text
      },
      onesContext
    );
  } catch (error) {
    logger.warn(
      `[agent-client-exchange] failed to post ${commentKind} comment`,
      {
        taskUUID: task.uuid,
        issueExecutionUUID: task.issueExecutionUUID,
        dispatchedIssueUUID: issueUUID,
        agentUUID: task.agentUUID,
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
}

async function maybeSendRevisionSummaryComment(
  task: IssueAgentExecutionHistoryWithExecutionRecord,
  text: string,
  onesContext: OnesOpenApiContext
): Promise<'sent' | 'duplicate' | 'failed'> {
  const issueUUID = task.issueExecution.dispatchedIssueUUID;

  try {
    const comments = await listIssueComments(
      issueUUID,
      onesContext,
      TASK_STARTED_COMMENT_FETCH_LIMIT
    );

    if (hasTaskCommentSinceQueuedAt(comments, text, task.queuedAt)) {
      return 'duplicate';
    }

    await sendIssueComment(issueUUID, { text }, onesContext);
    return 'sent';
  } catch (error) {
    logger.warn('[agent-client-exchange] failed to post revision summary', {
      taskUUID: task.uuid,
      issueExecutionUUID: task.issueExecutionUUID,
      dispatchedIssueUUID: issueUUID,
      agentUUID: task.agentUUID,
      error: error instanceof Error ? error.message : String(error)
    });
    return 'failed';
  }
}

async function writeTaskAttachmentsToIssue(
  taskUUID: string,
  clientUUID: string,
  issueAttachments: ScopedIssueAttachment[],
  onesContext: OnesOpenApiContext
): Promise<void> {
  if (issueAttachments.length === 0) {
    return;
  }

  for (const issueAttachment of issueAttachments) {
    for (const upload of issueAttachment.uploads) {
      await uploadStagedAttachmentToIssue(
        taskUUID,
        clientUUID,
        issueAttachment.issueUUID,
        upload,
        onesContext
      );
    }
  }
}

async function uploadStagedAttachmentToIssue(
  taskUUID: string,
  clientUUID: string,
  issueUUID: string,
  upload: AttachmentUpload,
  onesContext: OnesOpenApiContext
): Promise<string> {
  const stagedAttachment = await loadAgentClientTaskAttachment({
    taskUUID,
    clientUUID,
    resourceToken: upload.resourceToken
  });

  try {
    const buffer = await readFile(stagedAttachment.filePath);

    try {
      return await uploadIssueAttachment(
        issueUUID,
        {
          fileName: stagedAttachment.fileName,
          file: new Blob([buffer])
        },
        onesContext
      );
    } catch (error) {
      logger.error(
        '[agent-client-exchange] failed to upload ONES issue attachment',
        {
          taskUUID,
          clientUUID,
          issueUUID,
          fileName: stagedAttachment.fileName,
          resourceToken: upload.resourceToken,
          ...buildOutputWriteErrorContext(error)
        }
      );
      throw error;
    }
  } finally {
    await stagedAttachment.remove();
  }
}

export function buildCreateIssueRequest(plan: CreateRefObjectPlan): {
  projectID: string;
  issueTypeID: string;
  title: string;
  assignee?: string;
  watchers?: string[];
  parentID?: string;
  fieldValues?: Array<{ fieldID: string; value: unknown }>;
} {
  let projectID = '';
  let issueTypeID = '';
  let title = '';
  let assignee: string | undefined;
  let watchers: string[] | undefined;
  let parentID: string | undefined;
  const fieldValues: Array<{ fieldID: string; value: unknown }> = [];

  for (const fieldValue of plan.fieldValues) {
    if (fieldValue.fieldUUID === ISSUE_DISPLAY_ID_FIELD_UUID) {
      continue;
    }

    if (fieldValue.fieldUUID === ISSUE_PROJECT_FIELD_UUID) {
      projectID = String(fieldValue.value ?? '').trim();
      continue;
    }

    if (fieldValue.fieldUUID === ISSUE_TYPE_FIELD_UUID) {
      issueTypeID = String(fieldValue.value ?? '').trim();
      continue;
    }

    if (fieldValue.fieldUUID === ISSUE_TITLE_FIELD_UUID) {
      title = String(fieldValue.value ?? '').trim();
      continue;
    }

    if (fieldValue.fieldUUID === ISSUE_ASSIGNEE_FIELD_UUID) {
      const normalizedAssignee = String(fieldValue.value ?? '').trim();
      assignee = normalizedAssignee || undefined;
      continue;
    }

    if (fieldValue.fieldUUID === ISSUE_WATCHERS_FIELD_UUID) {
      const normalizedWatchers = (
        Array.isArray(fieldValue.value) ? fieldValue.value : [fieldValue.value]
      )
        .map((watcher) => String(watcher ?? '').trim())
        .filter(Boolean);

      watchers = normalizedWatchers.length > 0 ? normalizedWatchers : undefined;
      continue;
    }

    if (fieldValue.fieldUUID === PARENT_ISSUE_FIELD_UUID) {
      const normalizedParentID = String(fieldValue.value ?? '').trim();
      parentID = normalizedParentID || undefined;
      continue;
    }

    fieldValues.push({
      fieldID: fieldValue.fieldUUID,
      value: fieldValue.value
    });
  }

  if (!projectID) {
    throw new Error(
      `Create "${plan.outputFieldUUIDPath}" is missing project field`
    );
  }

  if (!issueTypeID) {
    throw new Error(
      `Create "${plan.outputFieldUUIDPath}" is missing issue type field`
    );
  }

  if (!title) {
    throw new Error(
      `Create "${plan.outputFieldUUIDPath}" is missing title field`
    );
  }

  return {
    projectID,
    issueTypeID,
    title,
    assignee,
    watchers,
    parentID,
    fieldValues: fieldValues.length > 0 ? fieldValues : undefined
  };
}

async function createRefObjectsInOnes(
  createRefObjectPlans: CreateRefObjectPlan[],
  onesContext: OnesOpenApiContext
): Promise<{
  logs: string[];
  createdIssueUUIDsByCreatePlanIndex: Map<number, string>;
  createdIssueUUIDsByOutputPath: Map<string, string[]>;
}> {
  const logs: string[] = [];
  const createdIssueUUIDsByCreatePlanIndex = new Map<number, string>();
  const createdIssueUUIDsByOutputPath = new Map<string, string[]>();

  for (const [createPlanIndex, plan] of createRefObjectPlans.entries()) {
    const request = buildCreateIssueRequest(plan);
    const result = await createIssue(request, onesContext);
    const createdIssueID = result.data?.id?.trim();
    const createdIssueNumber =
      typeof result.data?.number === 'number' ? result.data.number : null;
    const createdIssueRef = createdIssueNumber
      ? `#${createdIssueNumber}`
      : createdIssueID || '(unknown issue)';

    if (!createdIssueID) {
      throw new Error(
        `Created issue for "${plan.outputFieldUUIDPath}" did not return issue id`
      );
    }

    const existingCreatedIssueUUIDs =
      createdIssueUUIDsByOutputPath.get(plan.outputFieldUUIDPath) ?? [];
    existingCreatedIssueUUIDs.push(createdIssueID);
    createdIssueUUIDsByOutputPath.set(
      plan.outputFieldUUIDPath,
      existingCreatedIssueUUIDs
    );
    createdIssueUUIDsByCreatePlanIndex.set(createPlanIndex, createdIssueID);

    logs.push(
      `[system] created ONES issue for "${plan.outputFieldUUIDPath}" and linked ${createdIssueRef}`
    );
  }

  return {
    logs,
    createdIssueUUIDsByCreatePlanIndex,
    createdIssueUUIDsByOutputPath
  };
}

async function buildDeferredIssueReferenceFieldValues(
  deferredIssueReferenceWrites: DeferredIssueReferenceWrite[],
  createdIssueUUIDsByOutputPath: Map<string, string[]>,
  onesContext: OnesOpenApiContext
): Promise<ScopedIssueFieldValue[]> {
  return Promise.all(
    deferredIssueReferenceWrites.map(async (deferredWrite) => ({
      issueUUID: deferredWrite.targetIssueUUID,
      fieldUUID: deferredWrite.targetFieldUUID,
      value: await buildIssueReferenceFieldValue(
        deferredWrite.targetIssueUUID,
        deferredWrite.targetFieldUUID,
        deferredWrite.targetFieldValueType,
        [
          ...deferredWrite.updatedIssueUUIDs,
          ...(createdIssueUUIDsByOutputPath.get(
            deferredWrite.outputFieldUUIDPath
          ) ?? [])
        ],
        deferredWrite.fieldWriteMode,
        onesContext
      ),
      outputFieldUUIDPath: deferredWrite.outputFieldUUIDPath
    }))
  );
}

async function buildDeferredIssueAttachmentFieldValues(
  taskUUID: string,
  clientUUID: string,
  deferredIssueAttachmentFieldWrites: DeferredIssueAttachmentFieldWrite[],
  createdIssueUUIDsByCreatePlanIndex: Map<number, string>,
  onesContext: OnesOpenApiContext
): Promise<ScopedIssueFieldValue[]> {
  const scopedFieldValues: ScopedIssueFieldValue[] = [];

  for (const deferredWrite of deferredIssueAttachmentFieldWrites) {
    const targetIssueUUID =
      deferredWrite.targetIssueUUID?.trim() ||
      (typeof deferredWrite.createPlanIndex === 'number'
        ? createdIssueUUIDsByCreatePlanIndex.get(deferredWrite.createPlanIndex)
        : undefined);

    if (!targetIssueUUID) {
      throw new Error(
        `Missing created issue uuid for attachment output "${deferredWrite.outputFieldUUIDPath}"`
      );
    }

    const uploadedAttachmentUUIDs: string[] = [];

    for (const upload of deferredWrite.uploads) {
      uploadedAttachmentUUIDs.push(
        await uploadStagedAttachmentToIssue(
          taskUUID,
          clientUUID,
          targetIssueUUID,
          upload,
          onesContext
        )
      );
    }

    scopedFieldValues.push({
      issueUUID: targetIssueUUID,
      fieldUUID: deferredWrite.targetFieldUUID,
      value: buildReferenceFieldWriteValue(
        deferredWrite.targetFieldValueType,
        Array.from(
          new Set([
            ...deferredWrite.existingAttachmentUUIDs,
            ...uploadedAttachmentUUIDs
          ])
        )
      ),
      outputFieldUUIDPath: deferredWrite.outputFieldUUIDPath
    });
  }

  return scopedFieldValues;
}

async function transitionIssueStatusesIfNeeded(
  statusFieldValues: ScopedStatusFieldValue[],
  onesContext: OnesOpenApiContext
): Promise<{ logs: string[]; appliedTargetStatusNames: string[] }> {
  if (statusFieldValues.length === 0) {
    return { logs: [], appliedTargetStatusNames: [] };
  }

  const transitionLogs: string[] = [];
  const appliedTargetStatusNames: string[] = [];

  for (const statusFieldValue of statusFieldValues) {
    const targetStatusUUID = statusFieldValue.value.uuid?.trim() || '';
    const targetStatusName = statusFieldValue.value.name?.trim() || '';

    if ((!targetStatusUUID && !targetStatusName) || targetStatusName === '-') {
      continue;
    }

    const issue = await getIssue(statusFieldValue.issueUUID, onesContext);

    if (
      (targetStatusUUID && issue.status.id === targetStatusUUID) ||
      (!targetStatusUUID && issue.status.name === targetStatusName)
    ) {
      transitionLogs.push(
        `[system] skipped issue status transition for "${statusFieldValue.outputFieldUUIDPath}" because issue is already in target status`
      );
      continue;
    }

    const issueStatuses = await listIssueStatuses(onesContext);
    const matchedStatuses = targetStatusUUID
      ? issueStatuses.filter(
          (issueStatus) => issueStatus.id === targetStatusUUID
        )
      : issueStatuses.filter(
          (issueStatus) =>
            normalizeReferenceCandidateName(issueStatus.name) ===
            normalizeReferenceCandidateName(targetStatusName)
        );

    if (matchedStatuses.length === 0) {
      throw new Error(
        targetStatusUUID
          ? `Target status uuid "${targetStatusUUID}" not found`
          : `Target status "${targetStatusName}" not found`
      );
    }

    if (matchedStatuses.length > 1) {
      throw new Error(
        targetStatusUUID
          ? `Target status uuid "${targetStatusUUID}" matched multiple statuses`
          : `Target status "${targetStatusName}" matched multiple statuses`
      );
    }

    const targetStatus = matchedStatuses[0];
    const executableWorkflows = await listExecutableIssueWorkflows(
      statusFieldValue.issueUUID,
      onesContext
    );
    const matchedWorkflows = executableWorkflows.filter(
      (workflow) => workflow.end === targetStatus.id
    );

    if (matchedWorkflows.length === 0) {
      throw new Error(
        `No executable workflow found from "${issue.status.name}" to "${targetStatusName}"`
      );
    }

    if (matchedWorkflows.length > 1) {
      throw new Error(
        `Multiple executable workflows found from "${issue.status.name}" to "${targetStatusName}"`
      );
    }

    await executeIssueWorkflow(
      statusFieldValue.issueUUID,
      {
        id: matchedWorkflows[0].id
      },
      onesContext
    );

    transitionLogs.push(
      `[system] executed workflow "${matchedWorkflows[0].name}" for "${statusFieldValue.outputFieldUUIDPath}" to transition issue status from "${issue.status.name}" to "${targetStatusName}"`
    );
    appliedTargetStatusNames.push(targetStatusName);
  }

  return {
    logs: transitionLogs,
    appliedTargetStatusNames
  };
}

async function executeWorkflowNodePostActions(
  workflowNode: WorkflowNodeRecord,
  issueUUID: string,
  onesContext: OnesOpenApiContext
): Promise<{ logs: string[]; appliedTargetStatusNames: string[] }> {
  const logs: string[] = [];
  const appliedTargetStatusNames: string[] = [];

  for (const postAction of workflowNode.postActions) {
    if (postAction.type !== 'transition_issue_status') {
      continue;
    }

    const issue = await getIssue(issueUUID, onesContext);
    if (issue.status.id === postAction.targetStatus.uuid) {
      logs.push(
        `[system] skipped workflow node post-action because issue is already in status "${postAction.targetStatus.name}"`
      );
      continue;
    }

    const executableWorkflows = await listExecutableIssueWorkflows(
      issueUUID,
      onesContext
    );
    const matchedWorkflow = selectConfiguredPostActionWorkflow(
      executableWorkflows,
      postAction.targetStatus,
      issue.status.name
    );
    await executeIssueWorkflow(
      issueUUID,
      {
        id: matchedWorkflow.id
      },
      onesContext
    );
    logs.push(
      `[system] executed workflow node post-action "${matchedWorkflow.name}" to transition issue status from "${issue.status.name}" to "${postAction.targetStatus.name}"`
    );
    appliedTargetStatusNames.push(postAction.targetStatus.name);
  }

  return {
    logs,
    appliedTargetStatusNames
  };
}

export function selectConfiguredPostActionWorkflow(
  executableWorkflows: Array<{
    id: string;
    name: string;
    start: string;
    end: string;
  }>,
  targetStatus: RefObject,
  currentStatusName: string
) {
  const matchedWorkflows = executableWorkflows.filter(
    (workflow) => workflow.end === targetStatus.uuid
  );

  if (matchedWorkflows.length === 0) {
    throw new Error(
      `No executable workflow found from "${currentStatusName}" to configured post-action status "${targetStatus.name}"`
    );
  }

  if (matchedWorkflows.length > 1) {
    throw new Error(
      `Multiple executable workflows found from "${currentStatusName}" to configured post-action status "${targetStatus.name}"`
    );
  }

  return matchedWorkflows[0] as (typeof matchedWorkflows)[number];
}

function getLatestAgentExecution(
  issueExecution: IssueExecutionHistoryRecord
): IssueAgentExecutionHistoryRecord | null {
  return issueExecution.agentExecutions.at(-1) ?? null;
}

function getExecutionStartedAt(
  issueExecution: IssueExecutionHistoryRecord
): Date | null {
  return getLatestAgentExecution(issueExecution)?.startedAt ?? null;
}

function getExecutionFinishedAt(
  issueExecution: IssueExecutionHistoryRecord
): Date | null {
  return getLatestAgentExecution(issueExecution)?.finishedAt ?? null;
}

function getExecutionStatus(
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

async function refreshIssueExecutionAggregate(
  issueExecutionUUID: string,
  workflowNodeMap: WorkflowNodeMap,
  blockReasonOverride: string | null | undefined,
  teamUUID: string
) {
  const issueExecution = await findIssueExecutionHistoryByUUID(
    issueExecutionUUID,
    teamUUID
  );

  if (!issueExecution) {
    throw new InvalidAgentClientTaskReportError(issueExecutionUUID);
  }

  const workflowNode = workflowNodeMap.get(issueExecution.workflowNodeUUID);

  if (!workflowNode) {
    throw new InvalidAgentClientTaskReportError(
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
        status === 'blocked'
          ? (blockReasonOverride ?? issueExecution.blockReason ?? 'blocked')
          : null,
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

async function shouldBlockSuccessfulTaskReport(
  preparedReport: Pick<
    PreparedTaskReport,
    'dispatchedIssueUUID' | 'triggerStatusUUID' | 'triggerAssigneeUUID'
  >,
  onesContext: OnesOpenApiContext
): Promise<boolean> {
  const nextTrigger = await getIssueTriggerSnapshot(
    preparedReport.dispatchedIssueUUID,
    onesContext
  );

  return !didIssueTriggerChange(
    {
      statusUUID: preparedReport.triggerStatusUUID,
      assigneeUUID: preparedReport.triggerAssigneeUUID
    },
    nextTrigger
  );
}

async function shouldBlockFailedTaskReport(
  preparedReport: Pick<
    PreparedTaskReport,
    'issueExecutionUUID' | 'dispatchedIssueUUID' | 'workflowNodeUUID'
  >,
  teamUUID: string
): Promise<boolean> {
  const histories = await listIssueExecutionHistoriesByDispatchedIssueUUID(
    preparedReport.dispatchedIssueUUID,
    teamUUID
  );
  const previousHistories = histories.filter(
    (history) => history.uuid !== preparedReport.issueExecutionUUID
  );

  return shouldBlockAfterConsecutiveFailures(
    preparedReport.workflowNodeUUID,
    previousHistories
  );
}

type LoopGateEvaluation = {
  decision: 'pass' | 'revise' | 'escalate';
  deterministicValidation: PreparedTaskReport['deterministicValidation'];
  reviewResult: LoopReviewResult | null;
  budget: LoopBudgetSnapshot;
  summary: string;
  findings: string[];
};

function summarizeOutputWritePlan(
  plan: OutputWritePlan
): Record<string, unknown> {
  return {
    createIssueCount: plan.createRefObjectPlans.length,
    fieldTargets: plan.issueFieldValues.map(
      (value) => `${value.issueUUID}:${value.outputFieldUUIDPath}`
    ),
    commentTargets: plan.issueComments.map(
      (value) => `${value.issueUUID}:${value.outputFieldUUIDPath}`
    ),
    attachmentTargets: plan.issueAttachments.map(
      (value) => `${value.issueUUID}:${value.outputFieldUUIDPath}`
    ),
    wikiTargets: plan.wikiWrites.map((value) => ({
      action: value.action,
      outputFieldUUIDPath: value.outputFieldUUIDPath,
      pageUUID: value.pageUUID,
      parentPageUUID: value.parentPageUUID
    })),
    statusTargets: plan.statusFieldValues.map(
      (value) => `${value.issueUUID}:${value.outputFieldUUIDPath}`
    )
  };
}

function getKnowledgeContextMetadata(executeOption: unknown): unknown {
  if (
    !executeOption ||
    typeof executeOption !== 'object' ||
    Array.isArray(executeOption)
  ) {
    return null;
  }
  return (executeOption as { wikiContext?: unknown }).wikiContext ?? null;
}

async function validateLoopCandidateBeforeReview(input: {
  preparedReport: PreparedTaskReport;
  workflowNode: WorkflowNodeRecord;
  clientUUID: string;
  onesContext: OnesOpenApiContext;
}): Promise<void> {
  for (const plan of input.preparedReport.outputWritePlan
    .createRefObjectPlans) {
    buildCreateIssueRequest(plan);
  }

  const uploads = [
    ...input.preparedReport.outputWritePlan.issueAttachments.flatMap(
      (attachment) => attachment.uploads
    ),
    ...input.preparedReport.outputWritePlan.deferredIssueAttachmentFieldWrites.flatMap(
      (attachment) => attachment.uploads
    )
  ];
  for (const upload of uploads) {
    const staged = await loadAgentClientTaskAttachment({
      taskUUID: input.preparedReport.taskUUID,
      clientUUID: input.clientUUID,
      resourceToken: upload.resourceToken
    });
    await stat(staged.filePath);
  }

  for (const postAction of input.workflowNode.postActions) {
    if (postAction.type !== 'transition_issue_status') continue;
    const issue = await getIssue(
      input.preparedReport.dispatchedIssueUUID,
      input.onesContext
    );
    if (issue.status.id === postAction.targetStatus.uuid) continue;
    selectConfiguredPostActionWorkflow(
      await listExecutableIssueWorkflows(
        input.preparedReport.dispatchedIssueUUID,
        input.onesContext
      ),
      postAction.targetStatus,
      issue.status.name
    );
  }
}

function isNonRepairableLoopError(error: unknown): boolean {
  if (error instanceof OnesAuthError || error instanceof OnesConfigError) {
    return true;
  }
  if (error instanceof OnesRequestError) {
    return error.status === 401 || error.status === 403;
  }
  if (error instanceof OnesResponseError) {
    return /auth|permission|forbidden|credential|license|quota/i.test(
      `${error.code ?? ''} ${error.message}`
    );
  }
  return /permission|forbidden|credential|unauthorized|not configured/i.test(
    error instanceof Error ? error.message : String(error)
  );
}

async function evaluateLoopGate(input: {
  preparedReport: PreparedTaskReport;
  task: IssueAgentExecutionHistoryWithExecutionRecord;
  issueExecution: IssueExecutionHistoryRecord;
  workflowNode: WorkflowNodeRecord;
  agentConfig: AgentConfig;
  report: AgentClientTaskReport;
  clientUUID: string;
  onesContext: OnesOpenApiContext;
  exchangeAt: Date;
  teamUUID: string;
}): Promise<LoopGateEvaluation> {
  const deterministicValidation = {
    passed: input.preparedReport.deterministicValidation.passed,
    errors: [...input.preparedReport.deterministicValidation.errors],
    requiresEscalation:
      input.preparedReport.deterministicValidation.requiresEscalation
  };
  let forceEscalation =
    input.report.status === 'blocked' ||
    deterministicValidation.requiresEscalation;

  if (input.report.status === 'success' && deterministicValidation.passed) {
    try {
      await validateLoopCandidateBeforeReview({
        preparedReport: input.preparedReport,
        workflowNode: input.workflowNode,
        clientUUID: input.clientUUID,
        onesContext: input.onesContext
      });
    } catch (error) {
      deterministicValidation.passed = false;
      deterministicValidation.errors.push(
        error instanceof Error ? error.message : String(error)
      );
      forceEscalation = isNonRepairableLoopError(error);
      deterministicValidation.requiresEscalation = forceEscalation;
    }
  } else if (input.report.status !== 'success') {
    deterministicValidation.passed = false;
    deterministicValidation.errors.push(
      input.report.status === 'blocked'
        ? 'Agent Client reported a blocked execution'
        : 'Agent Client execution failed'
    );
  }

  let reviewResult: LoopReviewResult | null = null;
  if (deterministicValidation.passed && !forceEscalation) {
    try {
      reviewResult = await reviewLoopCandidate({
        teamUUID: input.teamUUID,
        agentName: input.task.agentName,
        taskPrompt: input.agentConfig.prompt,
        acceptancePolicy: input.agentConfig.acceptancePolicy,
        candidateOutput: input.report.executeResult,
        deterministicPlan: summarizeOutputWritePlan(
          input.preparedReport.outputWritePlan
        ),
        knowledgeContext: getKnowledgeContextMetadata(input.task.executeOption)
      });
    } catch (error) {
      forceEscalation = true;
      deterministicValidation.errors.push(
        `AI review unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const budget = calculateLoopBudget({
    policy: input.workflowNode.loopPolicy,
    executionCreatedAt: input.issueExecution.createdAt,
    attempts: input.issueExecution.agentExecutions,
    currentUsage: {
      inputTokens: input.report.usage?.inputTokens ?? null,
      outputTokens: input.report.usage?.outputTokens ?? null
    },
    reviewUsage: reviewResult?.usage,
    now: input.exchangeAt
  });
  const reviewDecision = reviewResult?.review.verdict ?? null;
  const findings = [
    ...deterministicValidation.errors,
    ...(reviewResult?.review.findings.map(
      (finding) => `${finding.message}；修改要求：${finding.repairInstruction}`
    ) ?? [])
  ];

  const decision = decideLoopGate({
    deterministicPassed: deterministicValidation.passed,
    forceEscalation,
    reviewVerdict: reviewDecision,
    budgetExhausted: budget.exhaustedBy.length > 0
  });

  if (decision === 'escalate') {
    return {
      decision: 'escalate',
      deterministicValidation,
      reviewResult,
      budget,
      summary:
        reviewResult?.review.summary ??
        (budget.exhaustedBy.length > 0
          ? `自动修正预算已耗尽：${budget.exhaustedBy.join(', ')}`
          : '自动修正需要人工接管。'),
      findings
    };
  }

  if (decision === 'revise') {
    return {
      decision: 'revise',
      deterministicValidation,
      reviewResult,
      budget,
      summary:
        reviewResult?.review.summary ?? '候选输出未通过确定性校验，需要修正。',
      findings
    };
  }

  return {
    decision: 'pass',
    deterministicValidation,
    reviewResult,
    budget,
    summary: reviewResult?.review.summary ?? '候选输出已通过验收。',
    findings
  };
}

async function maybeSendLoopLifecycleComment(
  task: IssueAgentExecutionHistoryWithExecutionRecord,
  text: string,
  commentKind: 'revision' | 'completion' | 'escalation',
  onesContext: OnesOpenApiContext
): Promise<'sent' | 'duplicate' | 'failed'> {
  try {
    const comments = await listIssueComments(
      task.issueExecution.dispatchedIssueUUID,
      onesContext,
      TASK_STARTED_COMMENT_FETCH_LIMIT
    );
    if (
      comments.some((comment) =>
        isSameLoopLifecycleComment(comment.text, text)
      )
    ) {
      return 'duplicate';
    }
    await sendIssueComment(
      task.issueExecution.dispatchedIssueUUID,
      { text },
      onesContext
    );
    return 'sent';
  } catch (error) {
    logger.warn(`[loop-engineering] failed to post ${commentKind} comment`, {
      taskUUID: task.uuid,
      issueExecutionUUID: task.issueExecutionUUID,
      error: error instanceof Error ? error.message : String(error)
    });
    return 'failed';
  }
}

async function executeLoopEscalationTransition(input: {
  workflowNode: WorkflowNodeRecord;
  issueUUID: string;
  onesContext: OnesOpenApiContext;
}): Promise<string> {
  const targetStatus = input.workflowNode.loopPolicy.escalationTargetStatus;
  if (!targetStatus) {
    throw new Error('Loop escalation target status is not configured');
  }
  const issue = await getIssue(input.issueUUID, input.onesContext);
  if (issue.status.id === targetStatus.uuid) {
    return `[system] skipped loop escalation transition because issue is already in status "${targetStatus.name}"`;
  }
  const workflow = selectConfiguredPostActionWorkflow(
    await listExecutableIssueWorkflows(input.issueUUID, input.onesContext),
    targetStatus,
    issue.status.name
  );
  await executeIssueWorkflow(
    input.issueUUID,
    { id: workflow.id },
    input.onesContext
  );
  return `[system] escalated loop execution from "${issue.status.name}" to "${targetStatus.name}"`;
}

async function persistLoopGateResult(input: {
  evaluation: LoopGateEvaluation;
  preparedReport: PreparedTaskReport;
  task: IssueAgentExecutionHistoryWithExecutionRecord;
  issueExecution: IssueExecutionHistoryRecord;
  workflowNodeMap: WorkflowNodeMap;
  workflowNode: WorkflowNodeRecord;
  report: AgentClientTaskReport;
  client: { uuid: string; name: string };
  exchangeAt: Date;
  teamUUID: string;
  onesContext: OnesOpenApiContext;
}): Promise<void> {
  let logs = appendLogMessage(
    input.preparedReport.logs,
    `[system] loop quality gate verdict: ${input.evaluation.decision}`
  );
  const loopEvaluation = {
    decision: input.evaluation.decision,
    deterministicValidation: input.evaluation.deterministicValidation,
    aiReview: input.evaluation.reviewResult?.review ?? null,
    reviewUsage: input.evaluation.reviewResult?.usage ?? null,
    budget: input.evaluation.budget
  };
  let escalationTransitionFailed = false;
  let loopLifecycleCommentStatus: 'sent' | 'duplicate' | 'failed' | null =
    null;

  if (input.evaluation.decision === 'revise') {
    const nextTaskUUID = buildNextLoopAttemptUUID(input.task.uuid);
    const existingNextTask = await findIssueAgentExecutionHistoryByUUID(
      nextTaskUUID,
      input.teamUUID
    );
    if (!existingNextTask) {
      await createIssueAgentExecutionHistories(
        [
          {
            uuid: nextTaskUUID,
            issueExecutionUUID: input.task.issueExecutionUUID,
            agentUUID: input.task.agentUUID,
            agentName: input.task.agentName,
            agentVersion: input.task.agentVersion,
            executorUUID: input.task.executorUUID,
            executorName: input.task.executorName,
            prompt: '',
            executePayload: {},
            executeOption: toJsonObject({
              loopContext: {
                source: 'automatic',
                attemptNumber: input.evaluation.budget.attemptNumber + 1,
                previousAttemptUUID: input.task.uuid,
                previousCandidate: input.report.executeResult,
                deterministicValidation:
                  input.evaluation.deterministicValidation,
                aiReview: input.evaluation.reviewResult?.review ?? null
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
        input.teamUUID
      );
    }
    logs = appendLogMessage(
      logs,
      `[system] created loop attempt ${input.evaluation.budget.attemptNumber + 1}`
    );
    loopLifecycleCommentStatus = await maybeSendLoopLifecycleComment(
      input.task,
      buildLoopRevisionComment({
        agentName: input.task.agentName,
        budget: input.evaluation.budget,
        summary: input.evaluation.summary,
        findings: input.evaluation.findings
      }),
      'revision',
      input.onesContext
    );
    logs = appendLogMessage(
      logs,
      `[system] loop revision comment: ${loopLifecycleCommentStatus}`
    );
  } else {
    try {
      logs = appendLogMessage(
        logs,
        await executeLoopEscalationTransition({
          workflowNode: input.workflowNode,
          issueUUID: input.preparedReport.dispatchedIssueUUID,
          onesContext: input.onesContext
        })
      );
    } catch (error) {
      escalationTransitionFailed = true;
      logs = appendLogMessage(
        logs,
        `[system] loop escalation status transition failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const comment = buildLoopEscalationComment({
      agentName: input.task.agentName,
      budget: input.evaluation.budget,
      summary: input.evaluation.summary,
      findings: input.evaluation.findings
    });
    loopLifecycleCommentStatus = await maybeSendLoopLifecycleComment(
      input.task,
      comment,
      'escalation',
      input.onesContext
    );
    logs = appendLogMessage(
      logs,
      `[system] loop escalation comment: ${loopLifecycleCommentStatus}`
    );
  }

  await updateIssueAgentExecutionHistory(
    {
      uuid: input.task.uuid,
      status: input.evaluation.decision === 'revise' ? 'failure' : 'blocked',
      logs: mergeLogHistory(input.task.logs, logs),
      executeResult: toJsonObject({
        ...input.preparedReport.executeResult,
        loopEvaluation,
        ...(loopLifecycleCommentStatus
          ? { loopLifecycleComment: { status: loopLifecycleCommentStatus } }
          : {})
      }),
      rawExecuteResult: input.report.executeResult,
      executeClientUUID: input.client.uuid,
      executeClientName: input.client.name,
      usageInputTokens: input.report.usage?.inputTokens ?? null,
      usageOutputTokens: input.report.usage?.outputTokens ?? null,
      lastReportedAt: input.exchangeAt,
      startedAt: input.preparedReport.startedAt,
      finishedAt: input.preparedReport.finishedAt ?? input.exchangeAt
    },
    input.teamUUID
  );

  await refreshIssueExecutionAggregate(
    input.preparedReport.issueExecutionUUID,
    input.workflowNodeMap,
    input.evaluation.decision === 'escalate'
      ? escalationTransitionFailed
        ? 'loop_escalation_transition_failed'
        : 'loop_escalated'
      : null,
    input.teamUUID
  );
  await removeAgentClientTaskAttachments(input.task.uuid);
}

async function applyTaskReport(
  report: AgentClientTaskReport,
  client: { uuid: string; name: string },
  workflowNodeMap: WorkflowNodeMap,
  agentConfigCache: AgentConfigCache,
  exchangeAt: Date,
  teamUUID: string
) {
  const preparedReport = await prepareTaskReport(
    report,
    client,
    agentConfigCache,
    teamUUID
  );
  let finalStatus = preparedReport.status;
  let finalLogs = preparedReport.logs;
  let finalBlockReason: string | null = null;
  const appliedWikiWrites: AppliedWikiWriteSummary[] = [];
  const appliedStatusTransitions: string[] = [];
  const onesContext = getExecutorOnesContext(preparedReport, teamUUID);
  const workflowNode = workflowNodeMap.get(preparedReport.workflowNodeUUID);
  const task = await findIssueAgentExecutionHistoryByUUID(
    preparedReport.taskUUID,
    teamUUID
  );

  if (!workflowNode) {
    throw new InvalidAgentClientTaskReportError(
      preparedReport.workflowNodeUUID
    );
  }
  if (!task) {
    throw new InvalidAgentClientTaskReportError(preparedReport.taskUUID);
  }

  const issueExecution = await findIssueExecutionHistoryByUUID(
    preparedReport.issueExecutionUUID,
    teamUUID
  );
  if (!issueExecution) {
    throw new InvalidAgentClientTaskReportError(
      preparedReport.issueExecutionUUID
    );
  }
  const runtimeAgentConfig = await loadAgentConfig(
    task.agentUUID,
    task.agentVersion,
    agentConfigCache,
    teamUUID
  );
  let loopEvaluationToPersist: Record<string, unknown> | null = null;
  let passedLoopEvaluation: LoopGateEvaluation | null = null;
  const loopEligible =
    runtimeAgentConfig !== null &&
    workflowNode.loopPolicy.enabled &&
    isLoopPolicyRuntimeEligible({
      teamEnabled: await isLoopRuntimeEnabled(teamUUID),
      policy: workflowNode.loopPolicy,
      agentConfig: runtimeAgentConfig
    });

  if (loopEligible && runtimeAgentConfig) {
    const evaluation = await evaluateLoopGate({
      preparedReport,
      task,
      issueExecution,
      workflowNode,
      agentConfig: runtimeAgentConfig,
      report,
      clientUUID: client.uuid,
      onesContext,
      exchangeAt,
      teamUUID
    });
    loopEvaluationToPersist = {
      decision: evaluation.decision,
      deterministicValidation: evaluation.deterministicValidation,
      aiReview: evaluation.reviewResult?.review ?? null,
      reviewUsage: evaluation.reviewResult?.usage ?? null,
      budget: evaluation.budget
    };
    if (evaluation.decision === 'pass') {
      passedLoopEvaluation = evaluation;
    }

    if (evaluation.decision !== 'pass') {
      await persistLoopGateResult({
        evaluation,
        preparedReport,
        task,
        issueExecution,
        workflowNodeMap,
        workflowNode,
        report,
        client,
        exchangeAt,
        teamUUID,
        onesContext
      });
      return;
    }
  }

  if (finalStatus === 'success') {
    let outputWriteStage: OutputWriteStage = 'creates';

    try {
      const createResult = await createRefObjectsInOnes(
        preparedReport.outputWritePlan.createRefObjectPlans,
        onesContext
      );

      for (const createLog of createResult.logs) {
        finalLogs = appendLogMessage(finalLogs, createLog);
      }

      const deferredIssueReferenceFieldValues =
        await buildDeferredIssueReferenceFieldValues(
          preparedReport.outputWritePlan.deferredIssueReferenceWrites,
          createResult.createdIssueUUIDsByOutputPath,
          onesContext
        );
      const deferredIssueAttachmentFieldValues =
        await buildDeferredIssueAttachmentFieldValues(
          preparedReport.taskUUID,
          client.uuid,
          preparedReport.outputWritePlan.deferredIssueAttachmentFieldWrites,
          createResult.createdIssueUUIDsByCreatePlanIndex,
          onesContext
        );

      outputWriteStage = 'fields';
      await writeTaskOutputsToIssue(
        [
          ...preparedReport.outputWritePlan.issueFieldValues,
          ...deferredIssueAttachmentFieldValues,
          ...deferredIssueReferenceFieldValues
        ],
        onesContext
      );
      finalLogs = appendLogMessage(
        finalLogs,
        '[system] wrote execute result to ONES fields'
      );
      outputWriteStage = 'comments';
      await writeTaskCommentsToIssue(
        preparedReport.outputWritePlan.issueComments,
        onesContext
      );
      finalLogs = appendLogMessage(
        finalLogs,
        '[system] wrote execute result to ONES comments'
      );
      outputWriteStage = 'attachments';
      await writeTaskAttachmentsToIssue(
        preparedReport.taskUUID,
        client.uuid,
        preparedReport.outputWritePlan.issueAttachments,
        onesContext
      );
      finalLogs = appendLogMessage(
        finalLogs,
        '[system] wrote execute result to ONES attachments'
      );
      outputWriteStage = 'wiki';
      const wikiFieldValues: ScopedIssueFieldValue[] = [];
      for (const wikiWrite of preparedReport.outputWritePlan.wikiWrites) {
        const appliedWikiWrite = await applyWikiWritePlan(
          wikiWrite,
          onesContext
        );
        appliedWikiWrites.push({
          action: wikiWrite.action,
          outputFieldUUIDPath: wikiWrite.outputFieldUUIDPath,
          pageTitle: appliedWikiWrite.pageTitle
        });
        finalLogs = appendLogMessage(finalLogs, appliedWikiWrite.log);
        const existingWikiFieldValue =
          wikiWrite.outputFieldValueType === 'multi_reference_object'
            ? (
                await getIssueFieldValues(
                  preparedReport.dispatchedIssueUUID,
                  [
                    {
                      uuid: wikiWrite.outputFieldUUID,
                      alias: wikiWrite.outputFieldUUID,
                      valueType: 'multi_reference_object',
                      referenceObjectType: 'wiki_page'
                    }
                  ],
                  onesContext
                )
              )?.[wikiWrite.outputFieldUUID]
            : null;
        wikiFieldValues.push({
          issueUUID: preparedReport.dispatchedIssueUUID,
          fieldUUID: wikiWrite.outputFieldUUID,
          value: buildWikiPageReferenceFieldValue(
            wikiWrite.outputFieldValueType,
            existingWikiFieldValue,
            appliedWikiWrite.pageUUID
          ),
          outputFieldUUIDPath: wikiWrite.outputFieldUUIDPath
        });
      }
      await writeTaskOutputsToIssue(wikiFieldValues, onesContext);
      if (wikiFieldValues.length > 0) {
        finalLogs = appendLogMessage(
          finalLogs,
          '[system] linked written Wiki pages to ONES issue fields'
        );
      }
      outputWriteStage = 'statuses';

      const transitionResult =
        workflowNode.postActions.length > 0
          ? preparedReport.outputWritePlan.statusFieldValues.length > 0
            ? {
                logs: [
                  '[system] ignored agent-produced status outputs because the workflow node has a configured post-action'
                ],
                appliedTargetStatusNames: []
              }
            : { logs: [], appliedTargetStatusNames: [] }
          : await transitionIssueStatusesIfNeeded(
              preparedReport.outputWritePlan.statusFieldValues,
              onesContext
            );

      for (const transitionLog of transitionResult.logs) {
        finalLogs = appendLogMessage(finalLogs, transitionLog);
      }
      appliedStatusTransitions.push(
        ...transitionResult.appliedTargetStatusNames
      );

      outputWriteStage = 'post_actions';
      const postActionResult = await executeWorkflowNodePostActions(
        workflowNode,
        preparedReport.dispatchedIssueUUID,
        onesContext
      );

      for (const postActionLog of postActionResult.logs) {
        finalLogs = appendLogMessage(finalLogs, postActionLog);
      }
      appliedStatusTransitions.push(
        ...postActionResult.appliedTargetStatusNames
      );

      if (await shouldBlockSuccessfulTaskReport(preparedReport, onesContext)) {
        finalStatus = 'blocked';
        finalBlockReason = 'trigger_not_consumed';
        finalLogs = appendLogMessage(
          finalLogs,
          `[system] blocked execution because status "${preparedReport.triggerStatusName}" and assignee "${preparedReport.triggerAssigneeName}" were unchanged after success`
        );
      }
    } catch (error) {
      logger.error(
        '[agent-client-exchange] failed to write task outputs to ONES',
        {
          taskUUID: preparedReport.taskUUID,
          issueExecutionUUID: preparedReport.issueExecutionUUID,
          dispatchedIssueUUID: preparedReport.dispatchedIssueUUID,
          executorUUID: preparedReport.executorUUID,
          clientUUID: client.uuid,
          stage: outputWriteStage,
          createIssueCount:
            preparedReport.outputWritePlan.createRefObjectPlans.length,
          fieldValueCount:
            preparedReport.outputWritePlan.issueFieldValues.length,
          commentCount: preparedReport.outputWritePlan.issueComments.length,
          attachmentGroupCount:
            preparedReport.outputWritePlan.issueAttachments.length,
          attachmentFileCount:
            preparedReport.outputWritePlan.issueAttachments.reduce(
              (count, issueAttachment) =>
                count + issueAttachment.uploads.length,
              0
            ),
          wikiWriteCount: preparedReport.outputWritePlan.wikiWrites.length,
          statusCount: preparedReport.outputWritePlan.statusFieldValues.length,
          ...buildOutputWriteErrorContext(error)
        }
      );
      finalStatus =
        outputWriteStage === 'wiki' || outputWriteStage === 'post_actions'
          ? 'blocked'
          : 'failure';
      if (outputWriteStage === 'wiki') {
        finalBlockReason = 'wiki_write_failed';
      } else if (outputWriteStage === 'post_actions') {
        finalBlockReason = 'post_action_failed';
      }
      finalLogs = appendLogMessage(
        finalLogs,
        buildOutputWriteFailureMessage(outputWriteStage, error)
      );
    }
  }

  if (finalStatus === 'failure') {
    if (await shouldBlockFailedTaskReport(preparedReport, teamUUID)) {
      finalStatus = 'blocked';
      finalBlockReason = 'two_consecutive_failures';
      finalLogs = appendLogMessage(
        finalLogs,
        '[system] blocked execution because the same workflow node failed 2 times consecutively'
      );
    }
  }

  let executeResultToPersist: Record<string, unknown> = {
    ...preparedReport.executeResult,
    ...(loopEvaluationToPersist
      ? { loopEvaluation: loopEvaluationToPersist }
      : {})
  };
  let agentConfigForSummary: AgentConfig | null = null;
  let appliedWrites: AppliedWriteSnapshot[] = [];
  if (finalStatus === 'success') {
    try {
      const agentConfig = await loadAgentConfig(
        task.agentUUID,
        task.agentVersion,
        agentConfigCache,
        teamUUID
      );
      if (agentConfig) {
        agentConfigForSummary = agentConfig;
        appliedWrites = await loadAppliedWriteSnapshot(
          preparedReport.dispatchedIssueUUID,
          agentConfig.outputs,
          onesContext
        );
        executeResultToPersist = {
          ...preparedReport.executeResult,
          ...(loopEvaluationToPersist
            ? { loopEvaluation: loopEvaluationToPersist }
            : {}),
          appliedWrites
        };
      }
    } catch (error) {
      finalLogs = appendLogMessage(
        finalLogs,
        `[system] could not snapshot applied outputs for future revision context: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const actualWriteDescriptions = agentConfigForSummary
    ? buildRevisionActualWriteDescriptions({
        outputWritePlan: preparedReport.outputWritePlan,
        agentConfig: agentConfigForSummary,
        appliedWrites,
        appliedWikiWrites,
        appliedStatusTransitions
      })
    : [];

  if (
    finalStatus === 'success' &&
    passedLoopEvaluation &&
    isAutomaticLoopAttempt(task.executeOption)
  ) {
    const loopCompletionCommentStatus = await maybeSendLoopLifecycleComment(
      task,
      buildLoopCompletionComment({
        agentName: task.agentName,
        attemptNumber: passedLoopEvaluation.budget.attemptNumber,
        summary: passedLoopEvaluation.summary,
        actualWrites: actualWriteDescriptions
      }),
      'completion',
      onesContext
    );
    executeResultToPersist = {
      ...executeResultToPersist,
      loopCompletionComment: { status: loopCompletionCommentStatus }
    };
    finalLogs = appendLogMessage(
      finalLogs,
      loopCompletionCommentStatus === 'failed'
        ? '[system] could not post loop completion comment; execution remains successful'
        : loopCompletionCommentStatus === 'duplicate'
          ? '[system] skipped duplicate loop completion comment'
          : '[system] posted loop completion comment'
    );
  }

  if (
    shouldSendRevisionSummaryComment({
      finalStatus,
      revisionContextEnabled: workflowNode.revisionContext.enabled,
      triggerReason: task.issueExecution.triggerReason
    })
  ) {
    const revisionSummaryComment = buildRevisionSummaryComment({
      agentName: task.agentName,
      iteration: task.issueExecution.iteration,
      feedbackCommentCount: getRevisionFeedbackCommentCount(task.executeOption),
      revisionSummary: preparedReport.executeResult.revisionSummary ?? null,
      actualWrites: actualWriteDescriptions
    });
    const revisionSummaryCommentStatus = await maybeSendRevisionSummaryComment(
      task,
      revisionSummaryComment,
      onesContext
    );

    executeResultToPersist = {
      ...executeResultToPersist,
      revisionSummaryComment: {
        status: revisionSummaryCommentStatus
      }
    };
    finalLogs = appendLogMessage(
      finalLogs,
      revisionSummaryCommentStatus === 'failed'
        ? '[system] could not post revision summary comment; execution remains successful'
        : revisionSummaryCommentStatus === 'duplicate'
          ? '[system] skipped duplicate revision summary comment'
          : '[system] posted revision summary comment'
    );
  }

  const mergedLogs = mergeLogHistory(task.logs, finalLogs);

  await updateIssueAgentExecutionHistory(
    {
      uuid: task.uuid,
      status: finalStatus,
      logs: mergedLogs,
      executeResult: toJsonObject(executeResultToPersist),
      rawExecuteResult: report.executeResult,
      executeClientUUID: client.uuid,
      executeClientName: client.name,
      usageInputTokens: report.usage?.inputTokens ?? null,
      usageOutputTokens: report.usage?.outputTokens ?? null,
      queuedAt:
        finalStatus === 'queued'
          ? (task.queuedAt ?? exchangeAt)
          : task.queuedAt,
      lastReportedAt: exchangeAt,
      startedAt: preparedReport.startedAt,
      finishedAt: preparedReport.finishedAt
    },
    teamUUID
  );

  if (
    shouldSendTaskStartedComment(task.status, finalStatus) &&
    !isAutomaticLoopAttempt(task.executeOption)
  ) {
    await maybeSendTaskStartedComment(task, onesContext);
  }

  if (finalStatus === 'blocked') {
    await maybeSendTaskBlockedComment(task, onesContext);
  }

  await refreshIssueExecutionAggregate(
    preparedReport.issueExecutionUUID,
    workflowNodeMap,
    finalBlockReason,
    teamUUID
  );
}

export function selectNextDispatchableTask(
  issueExecution: IssueExecutionHistoryRecord
): IssueAgentExecutionHistoryRecord | null {
  const latestAgentExecution = issueExecution.agentExecutions.at(-1) ?? null;

  if (!latestAgentExecution) {
    return null;
  }

  return latestAgentExecution.status === 'created'
    ? latestAgentExecution
    : null;
}

async function resolveAgentTaskBindings(
  agentUUID: string,
  teamUUID: string,
  cache: AgentTaskBindingsCache
): Promise<AgentTaskBindings> {
  const cached = cache.get(agentUUID);

  if (cached) {
    return cached;
  }

  const agent = await findAgentByUUID(agentUUID, teamUUID);

  if (!agent) {
    const emptyBindings: AgentTaskBindings = {
      sourceWorkspace: null,
      skillUUIDs: [],
      readableEnvKeys: []
    };
    cache.set(agentUUID, emptyBindings);
    return emptyBindings;
  }

  let sourceWorkspace: AgentClientTask['sourceWorkspace'] = null;
  let readableEnvKeys: string[] = [];

  if (agent.workspaceUUID) {
    const workspace = await findAgentWorkspaceByUUID(
      agent.workspaceUUID,
      teamUUID
    );
    const credentials = await listWorkspaceCredentialsByWorkspaceUUID(
      agent.workspaceUUID,
      teamUUID
    );
    readableEnvKeys = credentials.map((credential) => credential.envName);

    if (workspace) {
      const repositories = await listRepositoriesByAgentWorkspaceUUID(
        agent.workspaceUUID,
        teamUUID
      );
      sourceWorkspace = {
        uuid: agent.workspaceUUID,
        name: workspace.name,
        auth: await getAgentWorkspaceCloneAuth(agent.workspaceUUID, teamUUID),
        repositories: repositories.map((repository) => ({
          uuid: repository.uuid,
          url: repository.url
        }))
      };
    }
  }

  const bindings: AgentTaskBindings = {
    sourceWorkspace,
    skillUUIDs: [...agent.skillUUIDs],
    readableEnvKeys
  };
  cache.set(agentUUID, bindings);
  return bindings;
}

function toAgentClientTask(
  task:
    | IssueAgentExecutionHistoryRecord
    | IssueAgentExecutionHistoryWithExecutionRecord,
  bindings: AgentTaskBindings
): AgentClientTask {
  return {
    taskUUID: task.uuid,
    agent: {
      uuid: task.agentUUID,
      name: task.agentName
    },
    sourceWorkspace: bindings.sourceWorkspace,
    skillUUIDs: bindings.skillUUIDs,
    executeOption:
      typeof task.executeOption === 'object' &&
      task.executeOption !== null &&
      !Array.isArray(task.executeOption)
        ? (task.executeOption as Record<string, unknown>)
        : {},
    prompt: task.prompt
  };
}

async function dispatchTasks(
  availableSlots: number,
  client: { uuid: string; name: string },
  workflowNodeMap: WorkflowNodeMap,
  agentConfigCache: AgentConfigCache,
  agentTaskBindingsCache: AgentTaskBindingsCache,
  exchangeAt: Date,
  teamUUID: string
): Promise<AgentClientTask[]> {
  if (availableSlots <= 0) {
    return [];
  }

  const activeWorkflowUUIDs = new Set(
    (await listWorkflows(teamUUID))
      .filter((workflow) => workflow.isActive)
      .map((workflow) => workflow.uuid)
  );
  const issueExecutions = await listRunnableIssueExecutionHistories(teamUUID);
  const tasks: AgentClientTask[] = [];

  for (const issueExecution of issueExecutions) {
    if (tasks.length >= availableSlots) {
      break;
    }

    const workflowNode = workflowNodeMap.get(issueExecution.workflowNodeUUID);

    if (!workflowNode) {
      continue;
    }

    if (!activeWorkflowUUIDs.has(workflowNode.workflowUUID)) {
      continue;
    }

    const nextTask = selectNextDispatchableTask(issueExecution);

    if (!nextTask) {
      continue;
    }

    const agentConfig = await loadAgentConfig(
      nextTask.agentUUID,
      nextTask.agentVersion,
      agentConfigCache,
      teamUUID
    );

    if (!agentConfig) {
      logger.error(
        '[agent-client-exchange] skip task dispatch because agent config is missing',
        {
          issueExecutionUUID: issueExecution.uuid,
          taskUUID: nextTask.uuid,
          agentUUID: nextTask.agentUUID,
          agentVersion: nextTask.agentVersion
        }
      );
      continue;
    }

    const executeOption = {
      ...(typeof nextTask.executeOption === 'object' &&
      nextTask.executeOption !== null &&
      !Array.isArray(nextTask.executeOption)
        ? (nextTask.executeOption as Record<string, unknown>)
        : {}),
      ...getTaskExecuteOptionMetadata(agentConfig)
    };
    const bindings = await resolveAgentTaskBindings(
      nextTask.agentUUID,
      teamUUID,
      agentTaskBindingsCache
    );

    let executePayload: Record<string, unknown>;
    let inputContextXml: string;
    let wikiInputsXml = '<wiki-inputs />';
    let knowledgeContextXml = '<knowledge-context />';
    let revisionContextXml =
      '<revision-context><mode>initial</mode></revision-context>';
    const loopContextXml = buildLoopContextXml(nextTask.executeOption);

    try {
      const onesContext = getExecutorOnesContext(nextTask, teamUUID);
      const inputContext = await buildInputContext(
        issueExecution.dispatchedIssueUUID,
        agentConfig.inputs,
        onesContext
      );
      executePayload = inputContext.executePayload;
      inputContextXml = inputContext.inputContextXml;
      const issue = await getIssue(
        issueExecution.dispatchedIssueUUID,
        onesContext
      );
      const wikiContext = await buildAgentWikiRuntimeContext({
        issueUUID: issueExecution.dispatchedIssueUUID,
        issueName: issue?.name?.trim() || issueExecution.dispatchedIssueUUID,
        taskPrompt: agentConfig.prompt,
        inputSummary: JSON.stringify(executePayload).slice(0, 4000),
        inputs: agentConfig.inputs,
        knowledgeSourceUUIDs: agentConfig.knowledgeSourceUUIDs,
        onesContext
      });
      wikiInputsXml = wikiContext.wikiInputsXml;
      knowledgeContextXml = wikiContext.knowledgeContextXml;
      Object.assign(executeOption, {
        wikiContext: {
          inputPages: wikiContext.inputPages,
          knowledgeSources: wikiContext.knowledgeSources
        }
      });
      if (workflowNode.revisionContext.enabled) {
        const allExecutions =
          await listIssueExecutionHistoriesByDispatchedIssueUUID(
            issueExecution.dispatchedIssueUUID,
            teamUUID
          );
        const revisionContext = await buildRevisionRuntimeContext({
          currentExecution: issueExecution,
          allExecutions,
          agentConfig,
          onesContext,
          snapshotAt: exchangeAt
        });
        if (revisionContext) {
          revisionContextXml = revisionContext.xml;
          Object.assign(executeOption, {
            revisionContext: revisionContext.metadata
          });
        }
      }
    } catch (error) {
      logger.error(
        '[agent-client-exchange] skip task dispatch because execute payload build failed',
        {
          issueExecutionUUID: issueExecution.uuid,
          taskUUID: nextTask.uuid,
          agentUUID: nextTask.agentUUID,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      const blockReason =
        error instanceof RevisionContextBuildError
          ? error.code
          : 'wiki_or_input_context_error';
      await updateIssueAgentExecutionHistory(
        {
          uuid: nextTask.uuid,
          status: 'blocked',
          logs: appendLogMessage(
            nextTask.logs,
            `[system] blocked while preparing Wiki or input context: ${error instanceof Error ? error.message : String(error)}`
          ),
          executeResult: toJsonObject(
            typeof nextTask.executeResult === 'object' &&
              nextTask.executeResult !== null &&
              !Array.isArray(nextTask.executeResult)
              ? (nextTask.executeResult as Record<string, unknown>)
              : {}
          ),
          executeClientUUID: client.uuid,
          executeClientName: client.name,
          finishedAt: exchangeAt
        },
        teamUUID
      );
      await refreshIssueExecutionAggregate(
        issueExecution.uuid,
        workflowNodeMap,
        blockReason,
        teamUUID
      );
      continue;
    }

    let prompt: string;

    try {
      prompt = buildAgentPrompt(agentConfig, {
        inputContextXml,
        wikiInputsXml,
        knowledgeContextXml,
        revisionContextXml,
        loopContextXml,
        readableEnvKeys: bindings.readableEnvKeys
      });
    } catch (error) {
      logger.error(
        '[agent-client-exchange] skip task dispatch because prompt render failed',
        {
          issueExecutionUUID: issueExecution.uuid,
          taskUUID: nextTask.uuid,
          agentUUID: nextTask.agentUUID,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      continue;
    }

    const queuedTask = await updateIssueAgentExecutionHistory(
      {
        uuid: nextTask.uuid,
        prompt,
        status: 'queued',
        logs: nextTask.logs,
        executePayload: toJsonObject(executePayload),
        executeOption: toJsonObject(executeOption),
        executeResult: toJsonObject(
          typeof nextTask.executeResult === 'object' &&
            nextTask.executeResult !== null &&
            !Array.isArray(nextTask.executeResult)
            ? (nextTask.executeResult as Record<string, unknown>)
            : {}
        ),
        rawExecuteResult: nextTask.rawExecuteResult,
        executeClientUUID: client.uuid,
        executeClientName: client.name,
        queuedAt: exchangeAt,
        lastReportedAt: exchangeAt,
        startedAt: nextTask.startedAt,
        finishedAt: nextTask.finishedAt
      },
      teamUUID
    );

    await refreshIssueExecutionAggregate(
      issueExecution.uuid,
      workflowNodeMap,
      null,
      teamUUID
    );
    tasks.push(toAgentClientTask(queuedTask, bindings));
  }

  return tasks;
}

async function getWorkflowNodeMap(
  teamUUID: string,
  cache: Map<string, WorkflowNodeMap>
): Promise<WorkflowNodeMap> {
  const cachedMap = cache.get(teamUUID);

  if (cachedMap) {
    return cachedMap;
  }

  const workflowNodes = await listAllWorkflowNodes(teamUUID);
  const workflowNodeMap = new Map(
    workflowNodes.map((workflowNode) => [workflowNode.uuid, workflowNode])
  );

  cache.set(teamUUID, workflowNodeMap);
  return workflowNodeMap;
}

export async function reportAgentClientTasks(
  client: {
    uuid: string;
    name: string;
    hostname: string;
    version: string;
  },
  request: AgentClientTaskReportRequest
): Promise<AgentClientTaskReportResponse> {
  const exchangeAt = new Date();
  await updateAgentClientDisplay({
    uuid: client.uuid,
    name: client.name,
    hostname: client.hostname,
    version: client.version
  });
  await touchAgentClientExchange({
    uuid: client.uuid,
    exchangedAt: exchangeAt
  });

  const workflowNodeMapCache = new Map<string, WorkflowNodeMap>();
  const agentConfigCache: AgentConfigCache = new Map();

  for (const report of request.reports) {
    const teamUUID = await findIssueAgentExecutionHistoryTeamUUID(
      report.taskUUID
    );

    if (!teamUUID) {
      throw new InvalidAgentClientTaskReportError(report.taskUUID);
    }

    const workflowNodeMap = await getWorkflowNodeMap(
      teamUUID,
      workflowNodeMapCache
    );

    await applyTaskReport(
      report,
      client,
      workflowNodeMap,
      agentConfigCache,
      exchangeAt,
      teamUUID
    );
  }

  return {
    accepted: true
  };
}

export async function claimAgentClientTasks(
  client: {
    uuid: string;
    name: string;
    hostname: string;
    version: string;
  },
  request: AgentClientTaskClaimRequest
): Promise<AgentClientTaskClaimResponse> {
  const exchangeAt = new Date();
  await updateAgentClientDisplay({
    uuid: client.uuid,
    name: client.name,
    hostname: client.hostname,
    version: client.version
  });
  await touchAgentClientExchange({
    uuid: client.uuid,
    exchangedAt: exchangeAt
  });

  const workflowNodeMapCache = new Map<string, WorkflowNodeMap>();
  const agentConfigCache: AgentConfigCache = new Map();
  const agentTaskBindingsCache: AgentTaskBindingsCache = new Map();
  const tasks: AgentClientTask[] = [];
  const teamUUIDs = await listWorkflowTeamUUIDs();

  for (const teamUUID of teamUUIDs) {
    if (tasks.length >= request.availableSlots) {
      break;
    }

    const workflowNodeMap = await getWorkflowNodeMap(
      teamUUID,
      workflowNodeMapCache
    );
    const remainingSlots = request.availableSlots - tasks.length;
    const teamTasks = await dispatchTasks(
      remainingSlots,
      client,
      workflowNodeMap,
      agentConfigCache,
      agentTaskBindingsCache,
      exchangeAt,
      teamUUID
    );

    tasks.push(...teamTasks);
  }

  return {
    tasks
  };
}

export async function getAgentClientTaskRuntimeEnv(
  client: { uuid: string },
  taskUUID: string
): Promise<{ env: Record<string, string> }> {
  const teamUUID = await findIssueAgentExecutionHistoryTeamUUID(taskUUID);

  if (!teamUUID) {
    throw new AgentClientInvalidAttachmentUploadError(
      `Invalid task: ${taskUUID}`
    );
  }

  const task = await findIssueAgentExecutionHistoryByUUID(taskUUID, teamUUID);

  if (
    !task ||
    task.executeClientUUID !== client.uuid ||
    (task.status !== 'queued' && task.status !== 'running')
  ) {
    throw new AgentClientInvalidAttachmentUploadError(
      `Task is not available for runtime env: ${taskUUID}`
    );
  }

  const agent = await findAgentByUUID(task.agentUUID, teamUUID);

  if (!agent?.workspaceUUID) {
    return {
      env: {}
    };
  }

  return {
    env: await getAgentWorkspaceRuntimeEnv(agent.workspaceUUID, teamUUID)
  };
}

export async function stageAgentClientTaskAttachments(
  client: { uuid: string; name: string },
  taskUUID: string,
  files: Array<{
    localPath: string;
    name: string;
    type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
  }>
): Promise<{
  uploads: { resourceToken: string; fileName: string; localPath: string }[];
}> {
  if (files.length === 0) {
    throw new AgentClientInvalidAttachmentUploadError(
      'At least one attachment file is required'
    );
  }

  const teamUUID = await findIssueAgentExecutionHistoryTeamUUID(taskUUID);

  if (!teamUUID) {
    throw new AgentClientInvalidAttachmentUploadError(
      `Invalid task: ${taskUUID}`
    );
  }

  const task = await findIssueAgentExecutionHistoryByUUID(taskUUID, teamUUID);

  if (
    !task ||
    task.executeClientUUID !== client.uuid ||
    (task.status !== 'queued' && task.status !== 'running')
  ) {
    throw new AgentClientInvalidAttachmentUploadError(
      `Task is not available for attachment upload: ${taskUUID}`
    );
  }

  const stagedFiles = await Promise.all(
    files.map(async (file) => ({
      localPath: file.localPath,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer())
    }))
  );

  return {
    uploads: await stageAgentClientTaskAttachmentsInStorage({
      taskUUID,
      clientUUID: client.uuid,
      files: stagedFiles
    })
  };
}
