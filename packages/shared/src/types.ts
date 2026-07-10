export interface RefObject {
  uuid: string;
  name: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
}

export interface Workflow {
  uuid: string;
  name: string;
  isActive: boolean;
  nodes: WorkflowNode[];
}

export interface WorkflowSummary {
  uuid: string;
  name: string;
  isActive: boolean;
}

export interface WorkflowNode {
  uuid: string;
  project: RefObject;
  issueType: RefObject;
  status: RefObject;
  agent: Agent;
}

export interface Agent {
  uuid: string;
  name: string;
  currentVersion: number | null;
}

export interface AgentSummary {
  uuid: string;
  name: string;
  workspace: RefObject | null;
  skills: RefObject[];
  executor: RefObject | null;
}

export interface SkillSummary {
  uuid: string;
  name: string;
  description: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillManifestItem {
  uuid: string;
  name: string;
  description: string;
  version: number;
  updatedAt: string;
  downloadPath: string;
}

export interface SkillManifest {
  revision: string;
  skills: SkillManifestItem[];
}

export interface AgentWorkspaceRepository {
  uuid: string;
  url: string;
}

export interface AgentWorkspaceCredential {
  envName: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentWorkspaceAuthSummary =
  | {
      type: 'none';
    }
  | {
      type: 'ssh';
      publicKey: string | null;
    }
  | {
      type: 'https';
      username: string | null;
      hasSecret: boolean;
    };

export interface AgentWorkspace {
  uuid: string;
  name: string;
  auth: AgentWorkspaceAuthSummary;
  repositories: AgentWorkspaceRepository[];
  credentialCount: number;
}

export interface AgentVersion {
  uuid: string;
  agentUUID: string;
  version: number;
  config: AgentConfig;
}

export interface AgentConfig {
  description: string;
  prompt: string;
  inputs: AgentInputField[];
  outputs: AgentOutputField[];
}

export interface AgentFieldMeta {
  uuid: string;
  name: string;
  valueType: string;
  referenceObjectType: string | null;
}

export interface AgentInputField {
  field: AgentFieldMeta;
  description: string;
  subFields: AgentInputField[];
}

export interface AgentIOField {
  uuid: string;
  name: string;
  alias: string;
  description: string;
}

export interface AgentOutputSetValueField {
  mode: 'set_value';
  field: AgentFieldMeta;
  description: string;
  subFields: AgentOutputSetValueField[];
}

export type AgentOutputField = AgentOutputSetValueField;

export interface AgentDraft {
  uuid: string;
  name: string;
  workspaceUUID: string | null;
  skillUUIDs: string[];
  executor: RefObject | null;
  source: 'draft' | 'published' | 'empty';
  config: AgentConfig | null;
  publishedConfig: AgentConfig | null;
  hasUnpublishedDraft: boolean;
}

export interface OnesUserSummary {
  uuid: string;
  name: string;
  email: string | null;
  staffID: string | null;
}

export type AppAccessRole = 'admin' | 'member' | 'none';

export interface AppAccess {
  role: AppAccessRole;
  isAdmin: boolean;
}

export interface AppMember {
  userUUID: string;
  name: string;
  email: string | null;
  staffID: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AgentClientConnectionStatus =
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'revoked';

export type AgentClientRuntimeStatus = 'online' | 'offline';

export interface AgentClient {
  uuid: string;
  name: string;
  hostname: string;
  version: string;
  connectionStatus: AgentClientConnectionStatus;
  runtimeStatus: AgentClientRuntimeStatus;
  requestedAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
  lastExchangeAt: string | null;
}

export interface AgentClientSummary {
  uuid: string;
  name: string;
}

export type AgentExecutionStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'blocked';

export interface AgentTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export type IssueExecutionStatus =
  | 'created'
  | 'executing'
  | 'success'
  | 'failure'
  | 'blocked';

export interface DispatchedIssue {
  uuid: string;
  displayId: string;
  name: string;
  project: RefObject;
  issueType: RefObject;
  status: RefObject;
  assignee: RefObject;
  onesURL: string | null;
  latestExecutionUUID: string | null;
  latestExecutionStatus: IssueExecutionStatus | null;
  lastDispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueAgentExecutionHistory {
  uuid: string;
  agent: RefObject;
  executor: RefObject | null;
  agentVersion: number;
  prompt?: string;
  executePayload: Record<string, unknown>;
  executeResult: Record<string, unknown>;
  rawExecuteResult?: string;
  status: AgentExecutionStatus;
  logs?: string;
  usage: AgentTokenUsage | null;
  executeClient: RefObject | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface IssueExecutionHistory {
  uuid: string;
  dispatchedIssueUUID: string;
  status: IssueExecutionStatus;
  workflow: RefObject;
  workflowNode: RefObject;
  createdAt: string;
  currentAgentUUID: string;
  startedAt: string | null;
  finishedAt: string | null;
  agentExecutions: IssueAgentExecutionHistory[];
}

export type AgentClientTaskStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'blocked';

export interface AgentClientTaskReport {
  taskUUID: string;
  status: AgentClientTaskStatus;
  logs: string;
  executeResult: string;
  attachmentUploads?: AgentClientTaskAttachmentOutput[];
  usage: AgentTokenUsage | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AgentClientTaskAttachmentUpload {
  resourceToken: string;
  fileName: string;
  localPath: string;
}

export interface AgentClientTaskAttachmentOutput {
  outputName: string;
  uploads: AgentClientTaskAttachmentUpload[];
}

export interface AgentClientConnectRequestClient {
  uuid: string;
  name: string;
  hostname: string;
  version: string;
}

export interface AgentClientConnectRequest {
  client: AgentClientConnectRequestClient;
  connectCode: string;
}

export interface AgentClientConnectResponse {
  connectionRequestUUID: string;
  status: 'pending_approval';
  pollAfterMs: number;
}

export interface AgentClientConnectPollRequest {
  clientUUID: string;
  connectionRequestUUID: string;
  connectCode: string;
}

export type AgentClientConnectPollResponse =
  | {
      status: 'pending_approval';
      pollAfterMs: number;
    }
  | {
      status: 'approved';
      accessToken: string;
    }
  | {
      status: 'revoked';
      message: string;
    };

export interface AgentClientTaskReportRequest {
  reports: AgentClientTaskReport[];
}

export interface AgentClientTaskReportResponse {
  accepted: true;
}

export interface AgentClientTaskClaimRequest {
  availableSlots: number;
}

export interface AgentClientTaskSourceRepository {
  uuid: string;
  url: string;
}

export type AgentClientTaskSourceWorkspaceAuth =
  | {
      type: 'none';
    }
  | {
      type: 'ssh';
      publicKey: string | null;
      privateKey: string | null;
    }
  | {
      type: 'https';
      username: string;
      secret: string;
    };

export interface AgentClientTaskSourceWorkspace {
  uuid: string;
  name: string;
  auth: AgentClientTaskSourceWorkspaceAuth;
  repositories: AgentClientTaskSourceRepository[];
}

export interface AgentClientTask {
  taskUUID: string;
  agent: RefObject;
  sourceWorkspace: AgentClientTaskSourceWorkspace | null;
  skillUUIDs: string[];
  executeOption: Record<string, unknown>;
  prompt: string;
}

export interface AgentClientTaskClaimResponse {
  tasks: AgentClientTask[];
}

export interface AgentClientTaskRuntimeEnvResponse {
  env: Record<string, string>;
}

export interface AgentClientTaskAttachmentUploadResponse {
  uploads: AgentClientTaskAttachmentUpload[];
}
