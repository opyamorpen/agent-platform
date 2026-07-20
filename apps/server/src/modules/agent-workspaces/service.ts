import { randomUUID } from 'node:crypto';
import type {
  AgentClientTaskSourceWorkspaceAuth,
  AgentWorkspace,
  AgentWorkspaceCredential
} from '@ones-ai-workflow/shared';
import { deleteObject, readObjectJson, uploadObjectJson } from '../../lib/hosted-storage.js';
import {
  decryptWorkspaceCredentialValue,
  encryptWorkspaceCredentialValue,
  type EncryptedSecretPayload
} from '../../lib/workspace-credential-crypto.js';
import { findAgentsByWorkspaceUUID } from '../agents/repository.js';
import {
  createAgentWorkspace,
  createRepository,
  deleteAgentWorkspace,
  deleteRepository,
  type AgentWorkspaceAuthRecord,
  findAgentWorkspaceByUUID,
  findRepositoryByUUID,
  listAgentWorkspaces,
  listRepositoriesByAgentWorkspaceUUID,
  updateAgentWorkspace,
  updateAgentWorkspaceAuth,
  updateAgentWorkspaceKeys,
  updateRepository
} from './repository.js';
import {
  deleteWorkspaceCredential,
  findWorkspaceCredentialByEnvName,
  listWorkspaceCredentialsByWorkspaceUUID,
  saveWorkspaceCredential
} from './credentials-repository.js';
import { generateWorkspaceSshKeyPair } from './ssh-key.js';

export class AgentWorkspaceNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Agent workspace not found: ${uuid}`);
    this.name = 'AgentWorkspaceNotFoundError';
  }
}

export class RepositoryNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Repository not found: ${uuid}`);
    this.name = 'RepositoryNotFoundError';
  }
}

export class AgentWorkspaceInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentWorkspaceInUseError';
  }
}

export class WorkspaceCredentialNotFoundError extends Error {
  constructor(agentWorkspaceUUID: string, envName: string) {
    super(
      `Workspace credential not found: ${agentWorkspaceUUID} ${envName}`
    );
    this.name = 'WorkspaceCredentialNotFoundError';
  }
}

export class AgentWorkspaceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentWorkspaceAuthError';
  }
}

export async function getAgentWorkspaces(teamUUID: string): Promise<AgentWorkspace[]> {
  return listAgentWorkspaces(teamUUID);
}

export async function createAgentWorkspaceRecord(payload: {
  name: string;
}, teamUUID: string): Promise<AgentWorkspace> {
  const workspaceUUID = randomUUID();
  const createdWorkspace = await createAgentWorkspace({
    teamUUID,
    uuid: workspaceUUID,
    name: payload.name.trim(),
    auth: {
      type: 'none'
    }
  });

  return {
    uuid: createdWorkspace.uuid,
    name: createdWorkspace.name,
    auth: toAgentWorkspaceAuthSummary(createdWorkspace.auth),
    repositories: [],
    credentialCount: 0
  };
}

export async function updateAgentWorkspaceRecord(
  uuid: string,
  payload: {
    name: string;
  },
  teamUUID: string
): Promise<AgentWorkspace> {
  const updatedWorkspace = await updateAgentWorkspace(
    uuid,
    payload.name.trim(),
    teamUUID
  );

  if (!updatedWorkspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  const workspaces = await listAgentWorkspaces(teamUUID);
  const workspace = workspaces.find((item) => item.uuid === updatedWorkspace.uuid);

  return (
    workspace ?? {
      uuid: updatedWorkspace.uuid,
      name: updatedWorkspace.name,
      auth: toAgentWorkspaceAuthSummary(updatedWorkspace.auth),
      repositories: [],
      credentialCount: 0
    }
  );
}

export async function regenerateAgentWorkspaceKeyRecord(
  uuid: string,
  teamUUID: string
): Promise<AgentWorkspace> {
  const workspace = await findAgentWorkspaceByUUID(uuid, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  await assertRepositoryUrlsCompatibleWithAuth(
    uuid,
    workspace.auth.type,
    teamUUID
  );

  const sshKeyPair = await generateWorkspaceSshKeyPair(uuid);
  const updatedWorkspace = await updateAgentWorkspaceKeys(uuid, sshKeyPair, teamUUID);

  if (!updatedWorkspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  const workspaces = await listAgentWorkspaces(teamUUID);
  const refreshedWorkspace = workspaces.find((item) => item.uuid === uuid);

  return (
    refreshedWorkspace ?? {
      uuid: updatedWorkspace.uuid,
      name: updatedWorkspace.name,
      auth: toAgentWorkspaceAuthSummary(updatedWorkspace.auth),
      repositories: [],
      credentialCount: 0
    }
  );
}

export async function updateAgentWorkspaceAuthRecord(
  uuid: string,
  payload:
    | {
        type: 'none';
      }
    | {
        type: 'ssh';
      }
    | {
        type: 'https';
        username: string;
        secret?: string | null;
      },
  teamUUID: string
): Promise<AgentWorkspace> {
  const workspace = await findAgentWorkspaceByUUID(uuid, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  await assertRepositoryUrlsCompatibleWithAuth(uuid, payload.type, teamUUID);

  const currentAuth = workspace.auth;
  let nextAuth: AgentWorkspaceAuthRecord;

  if (payload.type === 'none') {
    nextAuth = {
      type: 'none'
    };
  } else if (payload.type === 'ssh') {
    nextAuth = {
      type: 'ssh',
      publicKey: currentAuth.type === 'ssh' ? currentAuth.publicKey : null,
      privateKey: currentAuth.type === 'ssh' ? currentAuth.privateKey : null
    };
  } else {
    const username = payload.username.trim();
    const nextSecretValue = payload.secret?.trim();
    const currentSecretObjectKey =
      currentAuth.type === 'https' ? currentAuth.secretObjectKey : null;
    let secretObjectKey = currentSecretObjectKey;

    if (nextSecretValue) {
      secretObjectKey = buildWorkspaceAuthSecretObjectKey(teamUUID, uuid);
      const encryptedSecret = await encryptWorkspaceCredentialValue(nextSecretValue);
      await uploadObjectJson(secretObjectKey, encryptedSecret);
    }

    if (!secretObjectKey) {
      throw new AgentWorkspaceAuthError(
        'HTTPS auth secret is required when configuring HTTPS authentication'
      );
    }

    nextAuth = {
      type: 'https',
      username,
      secretObjectKey
    };
  }

  const updatedWorkspace = await updateAgentWorkspaceAuth(uuid, nextAuth, teamUUID);

  if (!updatedWorkspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  if (
    currentAuth.type === 'https' &&
    currentAuth.secretObjectKey &&
    (
      nextAuth.type !== 'https' ||
      currentAuth.secretObjectKey !== nextAuth.secretObjectKey
    )
  ) {
    await deleteObject(currentAuth.secretObjectKey);
  }

  return getAgentWorkspaceOrThrow(uuid, teamUUID);
}

export async function removeAgentWorkspaceRecord(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const workspace = await findAgentWorkspaceByUUID(uuid, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  const referencingAgents = await findAgentsByWorkspaceUUID(uuid, teamUUID);

  if (referencingAgents.length > 0) {
    throw new AgentWorkspaceInUseError(
      `Agent workspace is referenced by agent ${referencingAgents[0]?.name ?? referencingAgents[0]?.uuid}`
    );
  }
  if (workspace.auth.type === 'https' && workspace.auth.secretObjectKey) {
    await deleteObject(workspace.auth.secretObjectKey);
  }

  await removeAllWorkspaceCredentialRecords(uuid, teamUUID);
  await deleteAgentWorkspace(uuid, teamUUID);
}

export async function createRepositoryRecord(
  agentWorkspaceUUID: string,
  payload: {
    urls: string[];
  },
  teamUUID: string
): Promise<AgentWorkspace> {
  const workspace = await findAgentWorkspaceByUUID(agentWorkspaceUUID, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(agentWorkspaceUUID);
  }

  assertRepositoryUrlCompatibleWithAuthType(payload.urls, workspace.auth.type);

  await Promise.all(
    payload.urls.map((url) =>
      createRepository({
        teamUUID,
        uuid: randomUUID(),
        agentWorkspaceUUID,
        url: url.trim()
      })
    )
  );

  return getAgentWorkspaceOrThrow(agentWorkspaceUUID, teamUUID);
}

export async function updateRepositoryRecord(
  uuid: string,
  payload: {
    url: string;
  },
  teamUUID: string
): Promise<AgentWorkspace> {
  const repository = await findRepositoryByUUID(uuid, teamUUID);

  if (!repository) {
    throw new RepositoryNotFoundError(uuid);
  }

  const workspace = await findAgentWorkspaceByUUID(repository.agentWorkspaceUUID, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(repository.agentWorkspaceUUID);
  }

  assertRepositoryUrlCompatibleWithAuthType([payload.url], workspace.auth.type);
  await updateRepository(uuid, payload.url.trim(), teamUUID);
  return getAgentWorkspaceOrThrow(repository.agentWorkspaceUUID, teamUUID);
}

export async function removeRepositoryRecord(
  uuid: string,
  teamUUID: string
): Promise<AgentWorkspace> {
  const repository = await findRepositoryByUUID(uuid, teamUUID);

  if (!repository) {
    throw new RepositoryNotFoundError(uuid);
  }

  await deleteRepository(uuid, teamUUID);
  return getAgentWorkspaceOrThrow(repository.agentWorkspaceUUID, teamUUID);
}

export async function getAgentWorkspaceCredentials(
  agentWorkspaceUUID: string,
  teamUUID: string
): Promise<AgentWorkspaceCredential[]> {
  await assertAgentWorkspaceExists(agentWorkspaceUUID, teamUUID);
  return listWorkspaceCredentialsByWorkspaceUUID(agentWorkspaceUUID, teamUUID);
}

export async function upsertAgentWorkspaceCredentialRecord(
  agentWorkspaceUUID: string,
  payload: {
    envName: string;
    value: string;
    description?: string | null;
  },
  actorUserUUID: string,
  teamUUID: string
): Promise<AgentWorkspaceCredential> {
  await assertAgentWorkspaceExists(agentWorkspaceUUID, teamUUID);

  const secretObjectKey = buildWorkspaceCredentialSecretObjectKey(
    teamUUID,
    agentWorkspaceUUID,
    payload.envName
  );
  const encryptedSecret = await encryptWorkspaceCredentialValue(payload.value);

  await uploadObjectJson(secretObjectKey, encryptedSecret);

  return saveWorkspaceCredential({
    teamUUID,
    agentWorkspaceUUID,
    envName: payload.envName,
    description: payload.description,
    secretObjectKey,
    createdBy: actorUserUUID
  });
}

export async function removeAgentWorkspaceCredentialRecord(
  agentWorkspaceUUID: string,
  envName: string,
  teamUUID: string
): Promise<void> {
  await assertAgentWorkspaceExists(agentWorkspaceUUID, teamUUID);
  const credential = await findWorkspaceCredentialByEnvName(
    agentWorkspaceUUID,
    envName,
    teamUUID
  );

  if (!credential) {
    throw new WorkspaceCredentialNotFoundError(agentWorkspaceUUID, envName);
  }

  await deleteObject(credential.secretObjectKey);
  await deleteWorkspaceCredential(agentWorkspaceUUID, envName, teamUUID);
}

export async function getAgentWorkspaceRuntimeEnv(
  agentWorkspaceUUID: string,
  teamUUID: string,
  allowedEnvNames?: readonly string[]
): Promise<Record<string, string>> {
  const workspaceCredentials = await listWorkspaceCredentialsByWorkspaceUUID(
    agentWorkspaceUUID,
    teamUUID
  );
  const credentials = allowedEnvNames
    ? allowedEnvNames.map((envName) => {
        const credential = workspaceCredentials.find(
          (item) => item.envName === envName
        );
        if (!credential) {
          throw new WorkspaceCredentialNotFoundError(
            agentWorkspaceUUID,
            envName
          );
        }
        return credential;
      })
    : workspaceCredentials;
  const envEntries = await Promise.all(
    credentials.map(async (credential) => {
      const payload = await readObjectJson<EncryptedSecretPayload>(
        credential.secretObjectKey
      );

      if (!payload) {
        throw new Error(
          `Workspace credential secret object not found: ${credential.secretObjectKey}`
        );
      }

      return [
        credential.envName,
        await decryptWorkspaceCredentialValue(payload)
      ] as const;
    })
  );

  return Object.fromEntries(envEntries);
}

export async function getAgentWorkspaceCloneAuth(
  agentWorkspaceUUID: string,
  teamUUID: string
): Promise<AgentClientTaskSourceWorkspaceAuth> {
  const workspace = await findAgentWorkspaceByUUID(agentWorkspaceUUID, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(agentWorkspaceUUID);
  }

  if (workspace.auth.type === 'ssh') {
    return {
      type: 'ssh',
      publicKey: workspace.auth.publicKey,
      privateKey: workspace.auth.privateKey
    };
  }

  if (workspace.auth.type === 'https') {
    if (!workspace.auth.username || !workspace.auth.secretObjectKey) {
      throw new AgentWorkspaceAuthError(
        `Workspace HTTPS auth is incomplete: ${agentWorkspaceUUID}`
      );
    }

    const payload = await readObjectJson<EncryptedSecretPayload>(
      workspace.auth.secretObjectKey
    );

    if (!payload) {
      throw new Error(
        `Workspace auth secret object not found: ${workspace.auth.secretObjectKey}`
      );
    }

    return {
      type: 'https',
      username: workspace.auth.username,
      secret: await decryptWorkspaceCredentialValue(payload)
    };
  }

  return {
    type: 'none'
  };
}

async function getAgentWorkspaceOrThrow(
  uuid: string,
  teamUUID: string
): Promise<AgentWorkspace> {
  const workspaces = await listAgentWorkspaces(teamUUID);
  const workspace = workspaces.find((item) => item.uuid === uuid);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }

  return workspace;
}

async function assertAgentWorkspaceExists(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const workspace = await findAgentWorkspaceByUUID(uuid, teamUUID);

  if (!workspace) {
    throw new AgentWorkspaceNotFoundError(uuid);
  }
}

async function removeAllWorkspaceCredentialRecords(
  agentWorkspaceUUID: string,
  teamUUID: string
): Promise<void> {
  const credentials = await listWorkspaceCredentialsByWorkspaceUUID(
    agentWorkspaceUUID,
    teamUUID
  );

  await Promise.all(
    credentials.map(async (credential) => {
      await deleteObject(credential.secretObjectKey);
      await deleteWorkspaceCredential(agentWorkspaceUUID, credential.envName, teamUUID);
    })
  );
}

function buildWorkspaceCredentialSecretObjectKey(
  teamUUID: string,
  agentWorkspaceUUID: string,
  envName: string
): string {
  return `workspace-credential/${teamUUID}/${agentWorkspaceUUID}/${envName}`;
}

function buildWorkspaceAuthSecretObjectKey(
  teamUUID: string,
  agentWorkspaceUUID: string
): string {
  return `wa_${teamUUID}_${agentWorkspaceUUID}`;
}

function toAgentWorkspaceAuthSummary(
  auth: AgentWorkspaceAuthRecord
): AgentWorkspace['auth'] {
  if (auth.type === 'ssh') {
    return {
      type: 'ssh',
      publicKey: auth.publicKey
    };
  }

  if (auth.type === 'https') {
    return {
      type: 'https',
      username: auth.username,
      hasSecret: Boolean(auth.secretObjectKey)
    };
  }

  return {
    type: 'none'
  };
}

async function assertRepositoryUrlsCompatibleWithAuth(
  agentWorkspaceUUID: string,
  authType: AgentWorkspaceAuthRecord['type'],
  teamUUID: string
): Promise<void> {
  const repositories = await listRepositoriesByAgentWorkspaceUUID(
    agentWorkspaceUUID,
    teamUUID
  );

  assertRepositoryUrlCompatibleWithAuthType(
    repositories.map((repository) => repository.url),
    authType
  );
}

function assertRepositoryUrlCompatibleWithAuthType(
  urls: string[],
  authType: AgentWorkspaceAuthRecord['type']
): void {
  const normalizedUrls = urls.map((url) => url.trim()).filter(Boolean);

  if (normalizedUrls.length === 0) {
    return;
  }

  const expectedProtocol = authType === 'ssh' ? 'ssh' : 'https';
  const invalidUrl = normalizedUrls.find((url) => {
    const protocol = classifyRepositoryUrl(url);
    return protocol !== expectedProtocol;
  });

  if (!invalidUrl) {
    return;
  }

  if (authType === 'ssh') {
    throw new AgentWorkspaceAuthError(
      `Repository URL must use SSH when workspace auth is SSH: ${invalidUrl}`
    );
  }

  throw new AgentWorkspaceAuthError(
    `Repository URL must use HTTPS when workspace auth is ${authType === 'https' ? 'HTTPS' : 'none'}: ${invalidUrl}`
  );
}

function classifyRepositoryUrl(url: string): 'ssh' | 'https' | 'unknown' {
  const trimmedUrl = url.trim();

  if (/^(?:[^\s@/:]+@[^/\s:]+:[^\s]+|ssh:\/\/[^\s]+)$/i.test(trimmedUrl)) {
    return 'ssh';
  }

  if (/^https:\/\/[^\s]+$/i.test(trimmedUrl)) {
    return 'https';
  }

  return 'unknown';
}
