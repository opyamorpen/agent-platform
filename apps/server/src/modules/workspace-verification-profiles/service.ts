import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { WorkspaceVerificationProfile } from '@ones-ai-workflow/shared';
import { findAgentWorkspaceByUUID, listRepositoriesByAgentWorkspaceUUID } from '../agent-workspaces/repository.js';
import {
  listAgentsWithDraftConfigs,
  listAgentVersionsWithConfigs
} from '../agents/repository.js';
import type { WorkspaceVerificationProfileMutationDTO } from './dto.js';
import {
  createWorkspaceVerificationProfile,
  deleteWorkspaceVerificationProfile,
  findWorkspaceVerificationProfile,
  listWorkspaceVerificationProfiles,
  updateWorkspaceVerificationProfile
} from './repository.js';

export class WorkspaceVerificationProfileNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Workspace verification profile not found: ${uuid}`);
    this.name = 'WorkspaceVerificationProfileNotFoundError';
  }
}

export class WorkspaceVerificationProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceVerificationProfileValidationError';
  }
}

export class WorkspaceVerificationProfileConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceVerificationProfileConflictError';
  }
}

export async function getWorkspaceVerificationProfiles(
  teamUUID: string
): Promise<WorkspaceVerificationProfile[]> {
  return listWorkspaceVerificationProfiles(teamUUID);
}

async function validateProfileInput(
  payload: WorkspaceVerificationProfileMutationDTO,
  teamUUID: string
): Promise<{ workspaceName: string }> {
  const workspace = await findAgentWorkspaceByUUID(payload.workspaceUUID, teamUUID);
  if (!workspace) {
    throw new WorkspaceVerificationProfileValidationError(
      `Agent workspace not found: ${payload.workspaceUUID}`
    );
  }
  const repositories = await listRepositoriesByAgentWorkspaceUUID(
    payload.workspaceUUID,
    teamUUID
  );
  const repositoryUUIDs = new Set(repositories.map((repository) => repository.uuid));
  const seenStepUUIDs = new Set<string>();
  for (const step of payload.steps) {
    if (seenStepUUIDs.has(step.uuid)) {
      throw new WorkspaceVerificationProfileValidationError(
        `Duplicate verification step uuid: ${step.uuid}`
      );
    }
    seenStepUUIDs.add(step.uuid);
    if (!repositoryUUIDs.has(step.repositoryUUID)) {
      throw new WorkspaceVerificationProfileValidationError(
        `Verification repository does not belong to workspace: ${step.repositoryUUID}`
      );
    }
    assertSafeWorkingDirectory(step.workingDirectory);
    if (/\r|\n|\0/u.test(step.executable)) {
      throw new WorkspaceVerificationProfileValidationError(
        `Invalid verification executable: ${step.name}`
      );
    }
    if (step.args.some((arg) => /\0/u.test(arg))) {
      throw new WorkspaceVerificationProfileValidationError(
        `Verification arguments contain invalid characters: ${step.name}`
      );
    }
  }
  return { workspaceName: workspace.name };
}

function assertSafeWorkingDirectory(value: string): void {
  if (!value) {
    return;
  }
  if (path.isAbsolute(value)) {
    throw new WorkspaceVerificationProfileValidationError(
      'Verification working directory must be relative to the repository'
    );
  }
  const normalized = path.posix.normalize(value.replace(/\\/gu, '/'));
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new WorkspaceVerificationProfileValidationError(
      'Verification working directory cannot leave the repository'
    );
  }
}

export async function createWorkspaceVerificationProfileRecord(
  payload: WorkspaceVerificationProfileMutationDTO,
  teamUUID: string,
  userUUID: string
): Promise<WorkspaceVerificationProfile> {
  const { workspaceName } = await validateProfileInput(payload, teamUUID);
  return createWorkspaceVerificationProfile({
    teamUUID,
    uuid: randomUUID(),
    workspaceUUID: payload.workspaceUUID,
    workspaceName,
    name: payload.name,
    steps: payload.steps,
    createdBy: userUUID
  });
}

export async function updateWorkspaceVerificationProfileRecord(
  uuid: string,
  payload: WorkspaceVerificationProfileMutationDTO,
  teamUUID: string
): Promise<WorkspaceVerificationProfile> {
  const current = await findWorkspaceVerificationProfile(uuid, teamUUID);
  if (!current) {
    throw new WorkspaceVerificationProfileNotFoundError(uuid);
  }
  const { workspaceName } = await validateProfileInput(payload, teamUUID);
  const updated = await updateWorkspaceVerificationProfile(uuid, teamUUID, {
    workspaceUUID: payload.workspaceUUID,
    workspaceName,
    name: payload.name,
    steps: payload.steps
  });
  if (!updated) {
    throw new WorkspaceVerificationProfileNotFoundError(uuid);
  }
  return updated;
}

export async function removeWorkspaceVerificationProfileRecord(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const current = await findWorkspaceVerificationProfile(uuid, teamUUID);
  if (!current) {
    throw new WorkspaceVerificationProfileNotFoundError(uuid);
  }
  const draftAgents = await listAgentsWithDraftConfigs(teamUUID);
  const draftReference = draftAgents.find((agent) =>
    agent.draftConfig?.acceptancePolicy.verificationProfileUUIDs.includes(uuid)
  );
  if (draftReference) {
    throw new WorkspaceVerificationProfileConflictError(
      `Verification profile is referenced by Agent draft: ${draftReference.name}`
    );
  }
  const publishedVersions = await listAgentVersionsWithConfigs(teamUUID);
  const publishedReference = publishedVersions.find((version) =>
    version.config.acceptancePolicy.verificationProfileUUIDs.includes(uuid)
  );
  if (publishedReference) {
    throw new WorkspaceVerificationProfileConflictError(
      `Verification profile is referenced by published Agent: ${publishedReference.agentUUID}`
    );
  }
  await deleteWorkspaceVerificationProfile(uuid, teamUUID);
}
