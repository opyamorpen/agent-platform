import { randomUUID } from 'node:crypto';
import type { AgentConfig, AgentDraft, AgentSummary } from '@ones-ai-workflow/shared';
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
  updateAgentMetadata,
  updateAgentDraftConfig
} from './repository.js';
import { listAllWorkflowNodes, listWorkflows } from '../workflows/repository.js';
import { findAgentWorkspaceByUUID } from '../agent-workspaces/repository.js';
import { listWorkspaceCredentialsByWorkspaceUUID } from '../agent-workspaces/credentials-repository.js';
import { findSkillsByUUIDs } from '../skills/repository.js';
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

export async function getAgentSummaries(teamUUID: string): Promise<AgentSummary[]> {
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
      ? (await findAgentVersion(sourceAgent.uuid, sourceAgent.currentVersion, teamUUID))
          ?.config ?? null
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
      ? (await findAgentVersion(uuid, agent.currentVersion, teamUUID))?.config ?? null
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

  const updatedAgent = await updateAgentDraftConfig(uuid, payload.config, teamUUID);

  return {
    uuid: updatedAgent.uuid,
    draftConfig: payload.config
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

  const latestVersion = await findLatestAgentVersion(uuid, teamUUID);
  const nextVersion = (latestVersion?.version ?? 0) + 1;
  await createAgentVersion(
    {
      uuid: randomUUID(),
      agentUUID: uuid,
      version: nextVersion,
      config: draftConfig,
      createdBy: payload.createdBy,
      note: payload.note
    },
    teamUUID
  );
  await publishAgentVersion(uuid, nextVersion, teamUUID);

  return {
    uuid,
    currentVersion: nextVersion,
    config: draftConfig
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

export async function removeAgent(uuid: string, teamUUID: string): Promise<void> {
  const agent = await findAgentByUUID(uuid, teamUUID);

  if (!agent) {
    throw new AgentNotFoundError(uuid);
  }

  const [workflowNodes, workflows] = await Promise.all([
    listAllWorkflowNodes(teamUUID),
    listWorkflows(teamUUID)
  ]);
  const workflowMap = new Map(workflows.map((workflow) => [workflow.uuid, workflow.name]));
  const referencingNode = workflowNodes.find((workflowNode) =>
    workflowNode.agentUUID === uuid
  );

  if (referencingNode) {
    const workflowName =
      workflowMap.get(referencingNode.workflowUUID) ?? referencingNode.workflowUUID;
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
  const missingSkillUUID = skillUUIDs.find((skillUUID) => !existingSkillUUIDs.has(skillUUID));

  if (missingSkillUUID) {
    throw new AgentSkillBindingNotFoundError(missingSkillUUID);
  }
}
