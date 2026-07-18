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
  postActions: WorkflowNodePostAction[];
  revisionContext: WorkflowNodeRevisionContext;
  loopPolicy: WorkflowNodeLoopPolicy;
}

export interface WorkflowNodeRevisionContext {
  enabled: boolean;
}

export interface WorkflowNodeLoopPolicy {
  enabled: boolean;
  maxAttempts: number;
  maxDurationMinutes: number;
  maxTotalTokens: number;
  escalationTargetStatus: RefObject | null;
}

export interface WorkflowNodeTransitionIssueStatusPostAction {
  type: 'transition_issue_status';
  targetStatus: RefObject;
}

export type WorkflowNodePostAction =
  WorkflowNodeTransitionIssueStatusPostAction;

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

export interface AIModelConfigStatus {
  configured: boolean;
}

export interface LoopRuntimeConfig {
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface AIModelConfig {
  provider: 'openai-compatible';
  baseURL: string;
  model: string;
  temperature: number;
  hasAPIKey: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export type SkillGenerationSessionStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'published'
  | 'failed';

export interface SkillGenerationMessage {
  uuid: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'interrupted';
  createdAt: string;
}

export interface SkillGenerationFile {
  path: string;
  content: string;
}

export interface SkillGenerationSessionSummary {
  uuid: string;
  title: string;
  status: SkillGenerationSessionStatus;
  revision: number;
  publishedSkillUUID: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillGenerationSession extends SkillGenerationSessionSummary {
  messages: SkillGenerationMessage[];
  files: SkillGenerationFile[];
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

export interface WorkspaceVerificationStep {
  uuid: string;
  name: string;
  repositoryUUID: string;
  workingDirectory: string;
  executable: string;
  args: string[];
  timeoutSeconds: number;
}

export interface WorkspaceVerificationProfile {
  uuid: string;
  workspaceUUID: string;
  workspaceName: string;
  name: string;
  steps: WorkspaceVerificationStep[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  inputs: AgentInput[];
  outputs: AgentOutputField[];
  knowledgeSourceUUIDs: string[];
  acceptancePolicy: AgentAcceptancePolicy;
  executionTarget: AgentExecutionTarget;
}

export type AgentExecutionTarget =
  | {
      mode: 'organization_model';
    }
  | {
      mode: 'agent_client';
      clientUUID: string | null;
      clientName: string | null;
    };

export interface AgentAcceptanceCriterion {
  uuid: string;
  name: string;
  description: string;
}

export interface AgentAcceptancePolicy {
  criteria: AgentAcceptanceCriterion[];
  knowledgeRequirement: 'optional' | 'required';
  verificationProfileUUIDs: string[];
}

export interface LoopAIReviewFinding {
  criterionUUID: string;
  severity: 'error' | 'warning';
  message: string;
  repairInstruction: string;
}

export interface LoopAIReview {
  verdict: 'pass' | 'revise' | 'escalate';
  confidence: number;
  summary: string;
  findings: LoopAIReviewFinding[];
}

export type AssetOptimizationRunStatus =
  | 'generating'
  | 'ready'
  | 'failed'
  | 'completed';

export type AssetOptimizationTrigger = 'manual' | 'automatic';

export type AssetCandidateType = 'prompt' | 'skill' | 'knowledge';

export type AssetCandidateStatus =
  | 'draft'
  | 'conflict'
  | 'applied'
  | 'reviewed'
  | 'dismissed';

export interface AssetOptimizationMetrics {
  totalSamples: number;
  successCount: number;
  problemCount: number;
  retryCount: number;
  averageAttempts: number;
  totalTokens: number | null;
  replaySampleCount: number;
}

export interface AssetReplayScore {
  estimatedPassRate: number;
  expectedAttempts: number;
  tokenChangePercent: number;
  findings: string[];
}

export interface AssetPromptCandidateContent {
  type: 'prompt';
  prompt: string;
}

export interface AssetSkillCandidateContent {
  type: 'skill';
  skillUUID: string | null;
  skillName: string;
  files: SkillGenerationFile[];
}

export interface AssetKnowledgeCandidateContent {
  type: 'knowledge';
  markdown: string;
}

export type AssetCandidateContent =
  | AssetPromptCandidateContent
  | AssetSkillCandidateContent
  | AssetKnowledgeCandidateContent;

export interface AssetCandidateSummary {
  uuid: string;
  runUUID: string;
  type: AssetCandidateType;
  status: AssetCandidateStatus;
  title: string;
  summary: string;
  targetUUID: string | null;
  baseRevision: number;
  hasScripts: boolean;
  replayScore: AssetReplayScore | null;
  conflictReason: string | null;
  appliedAssetUUID: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetCandidate extends AssetCandidateSummary {
  content: AssetCandidateContent;
}

export interface AssetOptimizationRunSummary {
  uuid: string;
  agent: RefObject;
  agentVersion: number;
  trigger: AssetOptimizationTrigger;
  status: AssetOptimizationRunStatus;
  metrics: AssetOptimizationMetrics;
  candidateCount: number;
  errorMessage: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AssetOptimizationRun extends AssetOptimizationRunSummary {
  candidates: AssetCandidate[];
}

export interface AgentFieldMeta {
  uuid: string;
  name: string;
  valueType: string;
  referenceObjectType: string | null;
}

export interface AgentInputField {
  kind?: 'issue_field';
  field: AgentFieldMeta;
  description: string;
  subFields: AgentInputField[];
}

export interface AgentWikiPageInput {
  kind: 'wiki_page';
  field: AgentFieldMeta;
  description: string;
  subFields: AgentInputField[];
}

export type AgentInput = AgentInputField | AgentWikiPageInput;

export interface AgentIOField {
  uuid: string;
  name: string;
  alias: string;
  description: string;
}

export interface AgentOutputSetValueField {
  kind?: 'issue_field';
  mode: 'set_value';
  field: AgentFieldMeta;
  description: string;
  subFields: AgentOutputSetValueField[];
}

export interface AgentWikiPageWriteTarget {
  type: 'space';
  spaceUUID: string;
  spaceName: string;
  homePageUUID: string;
}

export interface AgentWikiPageOutputField {
  kind: 'wiki_page';
  mode: 'wiki_page';
  field: AgentFieldMeta;
  description: string;
  writeTarget: AgentWikiPageWriteTarget | null;
  subFields: AgentOutputSetValueField[];
}

export type AgentOutputField =
  | AgentOutputSetValueField
  | AgentWikiPageOutputField;

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

export type KnowledgeSourceStatus = 'active' | 'disabled' | 'error';

export interface KnowledgeSource {
  uuid: string;
  name: string;
  description: string;
  spaceUUID: string;
  spaceName: string;
  homePageUUID: string;
  status: KnowledgeSourceStatus;
  lastSuccessfulQueryAt: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiSpaceSummary {
  uuid: string;
  name: string;
  description: string;
  homePageUUID: string;
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

export interface AgentClientOption extends AgentClientSummary {
  version: string;
  runtimeStatus: AgentClientRuntimeStatus;
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
  iteration: number;
  triggerReason: 'initial' | 'revision';
  previousExecutionUUID: string | null;
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
  verificationResults?: AgentClientVerificationProfileResult[];
  workspacePatch?: AgentClientWorkspacePatchUpload;
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

export type AgentClientCapability =
  | 'workspace-verification-v1'
  | 'workspace-patch-v1';

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
  capabilities?: AgentClientCapability[];
}

export interface AgentClientVerificationStepResult {
  stepUUID: string;
  stepName: string;
  repositoryUUID: string;
  command: string;
  status: 'passed' | 'failed' | 'timed_out' | 'skipped';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface AgentClientVerificationProfileResult {
  profileUUID: string;
  profileName: string;
  status: 'passed' | 'failed';
  steps: AgentClientVerificationStepResult[];
}

export interface AgentClientWorkspacePatchRepository {
  repositoryUUID: string;
  repositoryName: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  patch: string;
}

export interface AgentClientWorkspacePatchBundle {
  version: 1;
  sourceTaskUUID: string;
  repositories: AgentClientWorkspacePatchRepository[];
}

export interface AgentClientWorkspacePatchUpload {
  sourceTaskUUID: string;
  sha256: string;
  byteSize: number;
  repositoryCount: number;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface AgentClientWorkspacePatchUploadResponse {
  patch: AgentClientWorkspacePatchUpload;
}

export interface AgentClientPreviousWorkspacePatch {
  sourceTaskUUID: string;
  sha256: string;
  downloadPath: string;
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
  verificationProfiles?: WorkspaceVerificationProfile[];
  previousWorkspacePatch?: AgentClientPreviousWorkspacePatch | null;
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
