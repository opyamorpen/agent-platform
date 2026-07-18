import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  AgentDraft,
  AgentSummary
} from '@ones-ai-workflow/shared';
import type {
  AgentPromptPreviewDTO,
  CreateAgentDTO,
  DuplicateAgentDTO,
  PublishAgentDTO,
  SaveAgentDraftDTO,
  UpdateAgentDTO
} from './dto.js';
import {
  createAgent,
  deleteAgentByUUID,
  deleteAgentVersionsByAgentUUID,
  createAgentVersion,
  findAgentsBySkillUUID,
  findAgentsByWorkspaceUUID,
  findAgentByUUID,
  findAgentVersion,
  findLatestAgentVersion,
  listAgents,
  publishAgentVersion,
  replaceAgentKnowledgeBindings,
  updateAgentMetadata,
  updateAgentDraftConfig
} from './repository.js';
import {
  listAllWorkflowNodes,
  listWorkflows
} from '../workflows/repository.js';
import { findAgentWorkspaceByUUID } from '../agent-workspaces/repository.js';
import { listWorkspaceCredentialsByWorkspaceUUID } from '../agent-workspaces/credentials-repository.js';
import { findSkillsByUUIDs } from '../skills/repository.js';
import { findKnowledgeSourcesByUUIDs } from '../knowledge-sources/repository.js';
import { findWorkspaceVerificationProfilesByUUIDs } from '../workspace-verification-profiles/repository.js';
import { findAgentClientByUUID } from '../agent-clients/repository.js';
import { getAIModelConfigStatus } from '../ai-model-config/service.js';
import type { RefObject } from '@ones-ai-workflow/shared';
import { buildAgentPrompt } from './prompt-render.js';

export class AgentNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Agent not found: ${uuid}`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentConflictError extends Error {
  constructor(uuid: string) {
    super(`Agent uuid already exists: ${uuid}`);
    this.name = 'AgentConflictError';
  }
}

export class AgentDraftNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Agent draft config not found: ${uuid}`);
    this.name = 'AgentDraftNotFoundError';
  }
}

export class AgentInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentInUseError';
  }
}

export class AgentWorkspaceBindingNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Agent workspace not found: ${uuid}`);
    this.name = 'AgentWorkspaceBindingNotFoundError';
  }
}

export class AgentSkillBindingNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Skill not found: ${uuid}`);
    this.name = 'AgentSkillBindingNotFoundError';
  }
}

export class AgentKnowledgeBindingNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Knowledge source not found: ${uuid}`);
    this.name = 'AgentKnowledgeBindingNotFoundError';
  }
}

export class AgentVerificationProfileBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentVerificationProfileBindingError';
  }
}

export class AgentWikiWriteTargetRequiredError extends Error {
  constructor(fieldName: string) {
    super(`Wiki output field requires a write target: ${fieldName}`);
    this.name = 'AgentWikiWriteTargetRequiredError';
  }
}

export class AgentExecutionTargetBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentExecutionTargetBindingError';
  }
}

function normalizeExecutorBinding(
  executorUUID: string | null | undefined,
  executorName: string | null | undefined
): RefObject | null {
  const normalizedUUID = executorUUID?.trim() ?? '';
  const normalizedName = executorName?.trim() ?? '';

  if (!normalizedUUID || !normalizedName) {
    return null;
  }

  return {
    uuid: normalizedUUID,
    name: normalizedName
  };
}

export async function getAgentSummaries(
  teamUUID: string
): Promise<AgentSummary[]> {
  return listAgents(teamUUID);
}

export async function updateAgentRecord(
  uuid: string,
  payload: UpdateAgentDTO,
  teamUUID: string
): Promise<AgentSummary> {
  const agent = await findAgentByUUID(uuid, teamUUID);

  if (!agent) {
    throw new AgentNotFoundError(uuid);
  }

  const workspaceUUID = payload.workspaceUUID ?? null;
  const skillUUIDs = Array.from(new Set(payload.skillUUIDs ?? []));
  const executor = normalizeExecutorBinding(
    payload.executorUUID,
    payload.executorName
  );

  await assertAgentBindingsExist(workspaceUUID, skillUUIDs, teamUUID);
  return updateAgentMetadata(
    uuid,
    {
      name: payload.name,
      workspaceUUID,
      skillUUIDs,
      executor
    },
    teamUUID
  );
}

export async function createAgentRecord(
  payload: CreateAgentDTO,
  teamUUID: string
): Promise<AgentSummary> {
  const uuid = randomUUID();
  const workspaceUUID = payload.workspaceUUID ?? null;
  const skillUUIDs = Array.from(new Set(payload.skillUUIDs ?? []));
  const executor = normalizeExecutorBinding(
    payload.executorUUID,
    payload.executorName
  );

  await assertAgentBindingsExist(workspaceUUID, skillUUIDs, teamUUID);

  return createAgent(
    {
      uuid,
      name: payload.name,
      workspaceUUID,
      skillUUIDs,
      executor
    },
    teamUUID
  );
}

export async function duplicateAgentRecord(
  uuid: string,
  payload: DuplicateAgentDTO,
  teamUUID: string
): Promise<AgentSummary> {
  const sourceAgent = await findAgentByUUID(uuid, teamUUID);

  if (!sourceAgent) {
    throw new AgentNotFoundError(uuid);
  }

  const copiedConfig =
    sourceAgent.draftConfig ??
    (sourceAgent.currentVersion !== null
      ? ((
          await findAgentVersion(
            sourceAgent.uuid,
            sourceAgent.currentVersion,
            teamUUID
          )
        )?.config ?? null)
      : null);
  const nextUUID = randomUUID();
  const nextAgent = await createAgent(
    {
      uuid: nextUUID,
      name: payload.name?.trim() || `${sourceAgent.name} Copy`,
      workspaceUUID: sourceAgent.workspaceUUID,
      skillUUIDs: sourceAgent.skillUUIDs,
      executor: sourceAgent.executor
    },
    teamUUID
  );

  if (copiedConfig) {
    await updateAgentDraftConfig(nextUUID, copiedConfig, teamUUID);
  }

  return nextAgent;
}

export async function getAgentDraft(
  uuid: string,
  teamUUID: string
): Promise<AgentDraft> {
  const agent = await findAgentByUUID(uuid, teamUUID);

  if (!agent) {
    throw new AgentNotFoundError(uuid);
  }

  const draftConfig = agent.draftConfig;
  const publishedConfig =
    agent.currentVersion !== null
      ? ((await findAgentVersion(uuid, agent.currentVersion, teamUUID))
          ?.config ?? null)
      : null;

  if (draftConfig) {
    return {
      uuid: agent.uuid,
      name: agent.name,
      workspaceUUID: agent.workspaceUUID,
      skillUUIDs: agent.skillUUIDs,
      executor: agent.executor,
      source: 'draft',
      config: draftConfig,
      publishedConfig,
      hasUnpublishedDraft: true
    };
  }

  if (publishedConfig) {
    return {
      uuid: agent.uuid,
      name: agent.name,
      workspaceUUID: agent.workspaceUUID,
      skillUUIDs: agent.skillUUIDs,
      executor: agent.executor,
      source: 'published',
      config: publishedConfig,
      publishedConfig,
      hasUnpublishedDraft: false
    };
  }

  return {
    uuid: agent.uuid,
    name: agent.name,
    workspaceUUID: agent.workspaceUUID,
    skillUUIDs: agent.skillUUIDs,
    executor: agent.executor,
    source: 'empty',
    config: null,
    publishedConfig: null,
    hasUnpublishedDraft: false
  };
}

export async function saveAgentDraft(
  uuid: string,
  payload: SaveAgentDraftDTO,
  teamUUID: string
): Promise<{ uuid: string; draftConfig: AgentConfig }> {
  const agent = await findAgentByUUID(uuid, teamUUID);

  if (!agent) {
    throw new AgentNotFoundError(uuid);
  }

  await assertAgentKnowledgeSourcesExist(
    payload.config.knowledgeSourceUUIDs,
    teamUUID
  );
  await assertAgentVerificationProfilesExist(
    payload.config.acceptancePolicy.verificationProfileUUIDs,
    agent.workspaceUUID,
    teamUUID
  );
  const config = await resolveAgentExecutionTarget(
    payload.config,
    agent.workspaceUUID,
    teamUUID,
    false
  );

  const updatedAgent = await updateAgentDraftConfig(
    uuid,
    config,
    teamUUID
  );

  return {
    uuid: updatedAgent.uuid,
    draftConfig: config
  };
}

export async function publishAgentDraft(
  uuid: string,
  payload: PublishAgentDTO,
  teamUUID: string
): Promise<{ uuid: string; currentVersion: number; config: AgentConfig }> {
  const agent = await findAgentByUUID(uuid, teamUUID);

  if (!agent) {
    throw new AgentNotFoundError(uuid);
  }

  const draftConfig = agent.draftConfig;

  if (!draftConfig) {
    throw new AgentDraftNotFoundError(uuid);
  }

  await assertAgentKnowledgeSourcesExist(
    draftConfig.knowledgeSourceUUIDs,
    teamUUID
  );
  await assertAgentVerificationProfilesExist(
    draftConfig.acceptancePolicy.verificationProfileUUIDs,
    agent.workspaceUUID,
    teamUUID
  );
  const publishedConfig = await resolveAgentExecutionTarget(
    draftConfig,
    agent.workspaceUUID,
    teamUUID,
    true
  );
  assertAgentWikiWriteTargetsConfigured(publishedConfig);

  const latestVersion = await findLatestAgentVersion(uuid, teamUUID);
  const nextVersion = (latestVersion?.version ?? 0) + 1;
  await createAgentVersion(
    {
      uuid: randomUUID(),
      agentUUID: uuid,
      version: nextVersion,
      config: publishedConfig,
      createdBy: payload.createdBy,
      note: payload.note
    },
    teamUUID
  );
  await publishAgentVersion(uuid, nextVersion, teamUUID);
  await replaceAgentKnowledgeBindings(
    uuid,
    publishedConfig.knowledgeSourceUUIDs,
    teamUUID
  );

  return {
    uuid,
    currentVersion: nextVersion,
    config: publishedConfig
  };
}

export async function previewAgentPrompt(
  payload: AgentPromptPreviewDTO,
  teamUUID: string
): Promise<{ prompt: string }> {
  const workspaceUUID = payload.workspaceUUID?.trim() || null;
  let readableEnvKeys: string[] = [];

  if (workspaceUUID) {
    const workspace = await findAgentWorkspaceByUUID(workspaceUUID, teamUUID);

    if (!workspace) {
      throw new AgentWorkspaceBindingNotFoundError(workspaceUUID);
    }

    const credentials = await listWorkspaceCredentialsByWorkspaceUUID(
      workspaceUUID,
      teamUUID
    );
    readableEnvKeys = credentials.map((credential) => credential.envName);
  }

  return {
    prompt: buildAgentPrompt(payload.config, {
      readableEnvKeys
    })
  };
}

export async function removeAgent(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const agent = await findAgentByUUID(uuid, teamUUID);

  if (!agent) {
    throw new AgentNotFoundError(uuid);
  }

  const [workflowNodes, workflows] = await Promise.all([
    listAllWorkflowNodes(teamUUID),
    listWorkflows(teamUUID)
  ]);
  const workflowMap = new Map(
    workflows.map((workflow) => [workflow.uuid, workflow.name])
  );
  const referencingNode = workflowNodes.find(
    (workflowNode) => workflowNode.agentUUID === uuid
  );

  if (referencingNode) {
    const workflowName =
      workflowMap.get(referencingNode.workflowUUID) ??
      referencingNode.workflowUUID;
    throw new AgentInUseError(
      `Agent is referenced by workflow ${workflowName}`
    );
  }

  await deleteAgentVersionsByAgentUUID(uuid, teamUUID);
  await deleteAgentByUUID(uuid, teamUUID);
}

export async function getAgentsByWorkspaceUUID(
  workspaceUUID: string,
  teamUUID: string
): Promise<Array<{ uuid: string; name: string }>> {
  return findAgentsByWorkspaceUUID(workspaceUUID, teamUUID);
}

export async function getAgentsBySkillUUID(
  skillUUID: string,
  teamUUID: string
): Promise<Array<{ uuid: string; name: string }>> {
  return findAgentsBySkillUUID(skillUUID, teamUUID);
}

async function assertAgentBindingsExist(
  workspaceUUID: string | null,
  skillUUIDs: string[],
  teamUUID: string
): Promise<void> {
  if (workspaceUUID) {
    const workspace = await findAgentWorkspaceByUUID(workspaceUUID, teamUUID);

    if (!workspace) {
      throw new AgentWorkspaceBindingNotFoundError(workspaceUUID);
    }
  }

  if (skillUUIDs.length === 0) {
    return;
  }

  const skills = await findSkillsByUUIDs(skillUUIDs, teamUUID);
  const existingSkillUUIDs = new Set(skills.map((skill) => skill.uuid));
  const missingSkillUUID = skillUUIDs.find(
    (skillUUID) => !existingSkillUUIDs.has(skillUUID)
  );

  if (missingSkillUUID) {
    throw new AgentSkillBindingNotFoundError(missingSkillUUID);
  }
}

async function assertAgentKnowledgeSourcesExist(
  knowledgeSourceUUIDs: string[],
  teamUUID: string
): Promise<void> {
  if (knowledgeSourceUUIDs.length === 0) {
    return;
  }

  const knowledgeSources = await findKnowledgeSourcesByUUIDs(
    knowledgeSourceUUIDs,
    teamUUID
  );
  const existingUUIDs = new Set(knowledgeSources.map((source) => source.uuid));
  const missingUUID = knowledgeSourceUUIDs.find(
    (uuid) => !existingUUIDs.has(uuid)
  );

  if (missingUUID) {
    throw new AgentKnowledgeBindingNotFoundError(missingUUID);
  }
}

async function assertAgentVerificationProfilesExist(
  verificationProfileUUIDs: string[],
  workspaceUUID: string | null,
  teamUUID: string
): Promise<void> {
  if (verificationProfileUUIDs.length === 0) {
    return;
  }
  if (!workspaceUUID) {
    throw new AgentVerificationProfileBindingError(
      'Verification profiles require an Agent workspace'
    );
  }
  const profiles = await findWorkspaceVerificationProfilesByUUIDs(
    verificationProfileUUIDs,
    teamUUID
  );
  const profileByUUID = new Map(
    profiles.map((profile) => [profile.uuid, profile] as const)
  );
  for (const profileUUID of verificationProfileUUIDs) {
    const profile = profileByUUID.get(profileUUID);
    if (!profile) {
      throw new AgentVerificationProfileBindingError(
        `Verification profile not found: ${profileUUID}`
      );
    }
    if (profile.workspaceUUID !== workspaceUUID) {
      throw new AgentVerificationProfileBindingError(
        `Verification profile does not belong to the Agent workspace: ${profile.name}`
      );
    }
  }
}

async function resolveAgentExecutionTarget(
  config: AgentConfig,
  workspaceUUID: string | null,
  teamUUID: string,
  requireConfiguredModel: boolean
): Promise<AgentConfig> {
  if (config.executionTarget.mode === 'organization_model') {
    if (workspaceUUID) {
      throw new AgentExecutionTargetBindingError(
        'Organization AI model execution cannot use an Agent workspace'
      );
    }
    if (config.acceptancePolicy.verificationProfileUUIDs.length > 0) {
      throw new AgentExecutionTargetBindingError(
        'Organization AI model execution cannot use workspace verification profiles'
      );
    }
    if (requireConfiguredModel) {
      const status = await getAIModelConfigStatus(teamUUID);
      if (!status.configured) {
        throw new AgentExecutionTargetBindingError(
          'The organization AI model is not configured'
        );
      }
    }
    return {
      ...config,
      executionTarget: { mode: 'organization_model' }
    };
  }

  if (!config.executionTarget.clientUUID) {
    return {
      ...config,
      executionTarget: {
        mode: 'agent_client',
        clientUUID: null,
        clientName: null
      }
    };
  }

  const client = await findAgentClientByUUID(
    config.executionTarget.clientUUID
  );
  if (!client || client.connectionStatus !== 'active') {
    throw new AgentExecutionTargetBindingError(
      `Agent Client is not active: ${config.executionTarget.clientUUID}`
    );
  }

  return {
    ...config,
    executionTarget: {
      mode: 'agent_client',
      clientUUID: client.uuid,
      clientName: client.name
    }
  };
}

function assertAgentWikiWriteTargetsConfigured(config: AgentConfig): void {
  const outputWithoutTarget = config.outputs.find(
    (output) => output.kind === 'wiki_page' && !output.writeTarget
  );

  if (outputWithoutTarget?.kind === 'wiki_page') {
    throw new AgentWikiWriteTargetRequiredError(outputWithoutTarget.field.name);
  }
}
