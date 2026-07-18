import { randomUUID } from 'node:crypto';
import type { AgentConfig, AgentSummary } from '@ones-ai-workflow/shared';
import {
  buildHostedObjectKey,
  createEntityStore,
  deleteObject,
  readObjectJson,
  type HostedEntityEntry,
  uploadObjectJson
} from '../../lib/hosted-storage.js';
import { listAgentWorkspaces } from '../agent-workspaces/repository.js';
import { listSkills } from '../skills/repository.js';

const AGENT_ENTITY_NAME = 'agent';
const AGENT_SKILL_BINDING_ENTITY_NAME = 'agent_skill_binding';
const AGENT_KNOWLEDGE_BINDING_ENTITY_NAME = 'agent_knowledge_binding';
const AGENT_VERSION_ENTITY_NAME = 'agent_version';
const TEAM_UUID_INDEX_NAME = 'idx_team_uuid';
const AGENT_UUID_INDEX_NAME = 'idx_agent_uuid';
const SKILL_UUID_INDEX_NAME = 'idx_skill_uuid';
const KNOWLEDGE_SOURCE_UUID_INDEX_NAME = 'idx_knowledge_source_uuid';

const agentStore = createEntityStore<StoredAgentEntity>(AGENT_ENTITY_NAME);
const agentSkillBindingStore = createEntityStore<StoredAgentSkillBindingEntity>(
  AGENT_SKILL_BINDING_ENTITY_NAME
);
const agentKnowledgeBindingStore =
  createEntityStore<StoredAgentKnowledgeBindingEntity>(
    AGENT_KNOWLEDGE_BINDING_ENTITY_NAME
  );
const agentVersionStore = createEntityStore<StoredAgentVersionEntity>(
  AGENT_VERSION_ENTITY_NAME
);

type AgentSummaryRecord = AgentSummary;

type AgentMetaRecord = {
  uuid: string;
  name: string;
  workspaceUUID: string | null;
  skillUUIDs: string[];
  executor: { uuid: string; name: string } | null;
  currentVersion: number | null;
  draftObjectKey: string | null;
};

export type DispatchAgentRecord = {
  uuid: string;
  name: string;
  currentVersion: number | null;
  executor: { uuid: string; name: string } | null;
};

interface StoredAgentEntity {
  team_uuid: string;
  uuid: string;
  name: string;
  workspace_uuid: string;
  executor_uuid: string;
  executor_name: string;
  current_version: number;
  draft_object_key: string;
  created_at: number;
  updated_at: number;
}

interface StoredAgentSkillBindingEntity {
  team_uuid: string;
  uuid: string;
  agent_uuid: string;
  skill_uuid: string;
  created_at: number;
}

interface StoredAgentKnowledgeBindingEntity {
  team_uuid: string;
  uuid: string;
  agent_uuid: string;
  knowledge_source_uuid: string;
  created_at: number;
}

interface StoredAgentVersionEntity {
  team_uuid: string;
  uuid: string;
  agent_uuid: string;
  version: number;
  config_object_key: string;
  created_by: string;
  note: string;
  created_at: number;
}

function normalizeStoredAgentRecord(
  record: StoredAgentEntity
): StoredAgentEntity {
  return {
    ...record,
    workspace_uuid: record.workspace_uuid ?? '',
    executor_uuid: record.executor_uuid ?? '',
    executor_name: record.executor_name ?? ''
  };
}

function getAgentKey(uuid: string): string {
  return `agent_${uuid.replace(/-/g, '').toLowerCase()}`;
}

function getAgentVersionKey(agentUUID: string, version: number): string {
  return `agent_version_${agentUUID.replace(/-/g, '').toLowerCase()}_${version}`;
}

function getAgentSkillBindingKey(uuid: string): string {
  return `agent_skill_binding_${uuid.replace(/-/g, '').toLowerCase()}`;
}

function getAgentKnowledgeBindingKey(uuid: string): string {
  return `agent_knowledge_binding_${uuid.replace(/-/g, '').toLowerCase()}`;
}

function getDraftObjectKey(teamUUID: string, agentUUID: string): string {
  return buildHostedObjectKey('agent', teamUUID, agentUUID, 'draft.json');
}

function getVersionObjectKey(
  teamUUID: string,
  agentUUID: string,
  version: number
): string {
  return buildHostedObjectKey(
    'agent',
    teamUUID,
    agentUUID,
    `version-${version}.json`
  );
}

function normalizeCurrentVersion(value: number): number | null {
  return value > 0 ? value : null;
}

function normalizeWorkspaceUUID(
  value: string | null | undefined
): string | null {
  const normalized = (value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeExecutor(
  uuid: string | null | undefined,
  name: string | null | undefined
): { uuid: string; name: string } | null {
  const normalizedUUID = (uuid ?? '').trim();
  const normalizedName = (name ?? '').trim();

  if (!normalizedUUID || !normalizedName) {
    return null;
  }

  return {
    uuid: normalizedUUID,
    name: normalizedName
  };
}

function normalizeObjectKey(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toAgentMetaRecord(
  record: StoredAgentEntity,
  skillUUIDs: string[]
): AgentMetaRecord {
  return {
    uuid: record.uuid,
    name: record.name,
    workspaceUUID: normalizeWorkspaceUUID(record.workspace_uuid),
    skillUUIDs,
    executor: normalizeExecutor(record.executor_uuid, record.executor_name),
    currentVersion: normalizeCurrentVersion(record.current_version),
    draftObjectKey: normalizeObjectKey(record.draft_object_key)
  };
}

async function listTeamAgentEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentEntity>>> {
  return agentStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listTeamAgentVersionEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentVersionEntity>>> {
  return agentVersionStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listTeamAgentSkillBindingEntries(
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentSkillBindingEntity>>> {
  return agentSkillBindingStore.queryByIndexEqualTo(
    TEAM_UUID_INDEX_NAME,
    'team_uuid',
    teamUUID
  );
}

async function listAgentSkillBindingEntriesByAgentUUID(
  agentUUID: string,
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentSkillBindingEntity>>> {
  return (
    await agentSkillBindingStore.queryByIndexEqualTo(
      AGENT_UUID_INDEX_NAME,
      'agent_uuid',
      agentUUID
    )
  ).filter((entry) => entry.value.team_uuid === teamUUID);
}

async function listAgentSkillBindingEntriesBySkillUUID(
  skillUUID: string,
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentSkillBindingEntity>>> {
  return (
    await agentSkillBindingStore.queryByIndexEqualTo(
      SKILL_UUID_INDEX_NAME,
      'skill_uuid',
      skillUUID
    )
  ).filter((entry) => entry.value.team_uuid === teamUUID);
}

async function listAgentKnowledgeBindingEntriesByAgentUUID(
  agentUUID: string,
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentKnowledgeBindingEntity>>> {
  return (
    await agentKnowledgeBindingStore.queryByIndexEqualTo(
      AGENT_UUID_INDEX_NAME,
      'agent_uuid',
      agentUUID
    )
  ).filter((entry) => entry.value.team_uuid === teamUUID);
}

async function listAgentKnowledgeBindingEntriesByKnowledgeSourceUUID(
  knowledgeSourceUUID: string,
  teamUUID: string
): Promise<Array<HostedEntityEntry<StoredAgentKnowledgeBindingEntity>>> {
  return (
    await agentKnowledgeBindingStore.queryByIndexEqualTo(
      KNOWLEDGE_SOURCE_UUID_INDEX_NAME,
      'knowledge_source_uuid',
      knowledgeSourceUUID
    )
  ).filter((entry) => entry.value.team_uuid === teamUUID);
}

async function getStoredAgentByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredAgentEntity | null> {
  const record = await agentStore.get(getAgentKey(uuid));

  if (!record || record.team_uuid !== teamUUID) {
    return null;
  }

  return normalizeStoredAgentRecord(record);
}

async function getRequiredStoredAgentByUUID(
  uuid: string,
  teamUUID: string
): Promise<StoredAgentEntity> {
  const record = await getStoredAgentByUUID(uuid, teamUUID);

  if (!record) {
    throw new Error(`Agent not found in storage: ${uuid}`);
  }

  return record;
}

async function loadAgentConfig(
  objectKey: string | null
): Promise<AgentConfig | null> {
  if (!objectKey) {
    return null;
  }

  const config = await readObjectJson<AgentConfig>(objectKey);
  return config ? normalizeAgentConfig(config) : null;
}

function normalizeAgentConfig(config: AgentConfig): AgentConfig {
  const configuredExecutionTarget = config.executionTarget;
  const executionTarget =
    configuredExecutionTarget?.mode === 'organization_model'
      ? { mode: 'organization_model' as const }
      : configuredExecutionTarget?.mode === 'agent_client'
        ? {
            mode: 'agent_client' as const,
            clientUUID: configuredExecutionTarget.clientUUID?.trim() || null,
            clientName: configuredExecutionTarget.clientName?.trim() || null
          }
        : {
            mode: 'agent_client' as const,
            clientUUID: null,
            clientName: null
          };

  return {
    ...config,
    outputs: Array.isArray(config.outputs)
      ? config.outputs.map((output) =>
          output.kind === 'wiki_page'
            ? {
                ...output,
                writeTarget: output.writeTarget ?? null
              }
            : output
        )
      : [],
    knowledgeSourceUUIDs: Array.isArray(config.knowledgeSourceUUIDs)
      ? config.knowledgeSourceUUIDs
      : [],
    acceptancePolicy: {
      criteria: Array.isArray(config.acceptancePolicy?.criteria)
        ? config.acceptancePolicy.criteria
        : [],
      knowledgeRequirement:
        config.acceptancePolicy?.knowledgeRequirement === 'required'
          ? 'required'
          : 'optional',
      verificationProfileUUIDs: Array.isArray(
        config.acceptancePolicy?.verificationProfileUUIDs
      )
        ? config.acceptancePolicy.verificationProfileUUIDs
        : []
    },
    executionTarget
  };
}

async function readRequiredAgentConfig(
  objectKey: string
): Promise<AgentConfig> {
  const config = await readObjectJson<AgentConfig>(objectKey);
  if (!config) {
    throw new Error(`Agent config object is missing: ${objectKey}`);
  }
  return normalizeAgentConfig(config);
}

function mapSkillUUIDsByAgentUUID(
  bindings: StoredAgentSkillBindingEntity[]
): Map<string, string[]> {
  const skillUUIDsByAgentUUID = new Map<string, string[]>();

  for (const binding of bindings.sort(
    (left, right) => left.created_at - right.created_at
  )) {
    const current = skillUUIDsByAgentUUID.get(binding.agent_uuid) ?? [];
    current.push(binding.skill_uuid);
    skillUUIDsByAgentUUID.set(binding.agent_uuid, current);
  }

  return skillUUIDsByAgentUUID;
}

async function buildAgentSummaryRecords(
  records: StoredAgentEntity[],
  teamUUID: string
): Promise<AgentSummaryRecord[]> {
  if (records.length === 0) {
    return [];
  }

  const [workspaces, skills, bindingEntries] = await Promise.all([
    listAgentWorkspaces(teamUUID),
    listSkills(teamUUID),
    listTeamAgentSkillBindingEntries(teamUUID)
  ]);
  const workspaceNameByUUID = new Map(
    workspaces.map((workspace) => [workspace.uuid, workspace.name] as const)
  );
  const skillNameByUUID = new Map(
    skills.map((skill) => [skill.uuid, skill.name] as const)
  );
  const skillUUIDsByAgentUUID = mapSkillUUIDsByAgentUUID(
    bindingEntries.map((entry) => entry.value)
  );

  return records.map((record) => {
    const workspaceUUID = normalizeWorkspaceUUID(record.workspace_uuid);
    const skillUUIDs = skillUUIDsByAgentUUID.get(record.uuid) ?? [];

    return {
      uuid: record.uuid,
      name: record.name,
      workspace: workspaceUUID
        ? {
            uuid: workspaceUUID,
            name: workspaceNameByUUID.get(workspaceUUID) ?? workspaceUUID
          }
        : null,
      skills: skillUUIDs.map((skillUUID) => ({
        uuid: skillUUID,
        name: skillNameByUUID.get(skillUUID) ?? skillUUID
      })),
      executor: normalizeExecutor(record.executor_uuid, record.executor_name)
    };
  });
}

async function replaceAgentSkillBindings(
  agentUUID: string,
  skillUUIDs: string[],
  teamUUID: string
): Promise<void> {
  const currentBindings = await listAgentSkillBindingEntriesByAgentUUID(
    agentUUID,
    teamUUID
  );

  await Promise.all(
    currentBindings.map((binding) =>
      agentSkillBindingStore.delete(getAgentSkillBindingKey(binding.value.uuid))
    )
  );

  const uniqueSkillUUIDs = Array.from(new Set(skillUUIDs));
  const baseCreatedAt = Date.now();
  const nextBindings = uniqueSkillUUIDs.map((skillUUID, index) => ({
    team_uuid: teamUUID,
    uuid: randomUUID(),
    agent_uuid: agentUUID,
    skill_uuid: skillUUID,
    created_at: baseCreatedAt + index
  }));

  await Promise.all(
    nextBindings.map((binding) =>
      agentSkillBindingStore.set(getAgentSkillBindingKey(binding.uuid), binding)
    )
  );
}

export async function replaceAgentKnowledgeBindings(
  agentUUID: string,
  knowledgeSourceUUIDs: string[],
  teamUUID: string
): Promise<void> {
  const currentBindings = await listAgentKnowledgeBindingEntriesByAgentUUID(
    agentUUID,
    teamUUID
  );

  await Promise.all(
    currentBindings.map((binding) =>
      agentKnowledgeBindingStore.delete(
        getAgentKnowledgeBindingKey(binding.value.uuid)
      )
    )
  );

  const baseCreatedAt = Date.now();
  const bindings = Array.from(new Set(knowledgeSourceUUIDs)).map(
    (knowledgeSourceUUID, index): StoredAgentKnowledgeBindingEntity => ({
      team_uuid: teamUUID,
      uuid: randomUUID(),
      agent_uuid: agentUUID,
      knowledge_source_uuid: knowledgeSourceUUID,
      created_at: baseCreatedAt + index
    })
  );

  await Promise.all(
    bindings.map((binding) =>
      agentKnowledgeBindingStore.set(
        getAgentKnowledgeBindingKey(binding.uuid),
        binding
      )
    )
  );
}

export async function listAgents(
  teamUUID: string
): Promise<AgentSummaryRecord[]> {
  const entries = await listTeamAgentEntries(teamUUID);
  const records = entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at);

  return buildAgentSummaryRecords(records, teamUUID);
}

export async function createAgent(
  data: {
    uuid: string;
    name: string;
    workspaceUUID: string | null;
    skillUUIDs: string[];
    executor: { uuid: string; name: string } | null;
  },
  teamUUID: string
): Promise<AgentSummaryRecord> {
  const now = Date.now();

  await agentStore.set(getAgentKey(data.uuid), {
    team_uuid: teamUUID,
    uuid: data.uuid,
    name: data.name,
    workspace_uuid: data.workspaceUUID ?? '',
    executor_uuid: data.executor?.uuid ?? '',
    executor_name: data.executor?.name ?? '',
    current_version: 0,
    draft_object_key: '',
    created_at: now,
    updated_at: now
  });

  await replaceAgentSkillBindings(data.uuid, data.skillUUIDs, teamUUID);
  return (
    await buildAgentSummaryRecords(
      [
        {
          team_uuid: teamUUID,
          uuid: data.uuid,
          name: data.name,
          workspace_uuid: data.workspaceUUID ?? '',
          executor_uuid: data.executor?.uuid ?? '',
          executor_name: data.executor?.name ?? '',
          current_version: 0,
          draft_object_key: '',
          created_at: now,
          updated_at: now
        }
      ],
      teamUUID
    )
  )[0] as AgentSummaryRecord;
}

export async function findAgentByUUID(uuid: string, teamUUID: string) {
  const record = await getStoredAgentByUUID(uuid, teamUUID);

  if (!record) {
    return null;
  }

  const skillUUIDs = (
    await listAgentSkillBindingEntriesByAgentUUID(uuid, teamUUID)
  ).map((entry) => entry.value.skill_uuid);
  const meta = toAgentMetaRecord(record, skillUUIDs);
  const draftConfig = await loadAgentConfig(meta.draftObjectKey);

  return {
    uuid: meta.uuid,
    name: meta.name,
    workspaceUUID: meta.workspaceUUID,
    skillUUIDs: meta.skillUUIDs,
    executor: meta.executor,
    currentVersion: meta.currentVersion,
    draftConfig
  };
}

export async function updateAgentDraftConfig(
  uuid: string,
  draftConfig: AgentConfig,
  teamUUID: string
) {
  const record = await getRequiredStoredAgentByUUID(uuid, teamUUID);
  const objectKey = getDraftObjectKey(teamUUID, uuid);

  await uploadObjectJson(objectKey, draftConfig);
  await agentStore.set(getAgentKey(uuid), {
    ...record,
    draft_object_key: objectKey,
    updated_at: Date.now()
  });

  return {
    uuid,
    draftConfig
  };
}

export async function updateAgentMetadata(
  uuid: string,
  data: {
    name: string;
    workspaceUUID: string | null;
    skillUUIDs: string[];
    executor: { uuid: string; name: string } | null;
  },
  teamUUID: string
) {
  const record = await getRequiredStoredAgentByUUID(uuid, teamUUID);
  const updatedAt = Date.now();

  await agentStore.set(getAgentKey(uuid), {
    ...record,
    name: data.name,
    workspace_uuid: data.workspaceUUID ?? '',
    executor_uuid: data.executor?.uuid ?? '',
    executor_name: data.executor?.name ?? '',
    updated_at: updatedAt
  });
  await replaceAgentSkillBindings(uuid, data.skillUUIDs, teamUUID);

  return (
    await buildAgentSummaryRecords(
      [
        {
          ...record,
          name: data.name,
          workspace_uuid: data.workspaceUUID ?? '',
          executor_uuid: data.executor?.uuid ?? '',
          executor_name: data.executor?.name ?? '',
          updated_at: updatedAt
        }
      ],
      teamUUID
    )
  )[0] as AgentSummaryRecord;
}

export async function findAgentVersion(
  agentUUID: string,
  version: number,
  teamUUID: string
) {
  const entries = await listTeamAgentVersionEntries(teamUUID);
  const record = entries.find(
    (entry) =>
      entry.value.agent_uuid === agentUUID && entry.value.version === version
  )?.value;

  if (!record) {
    return null;
  }

  return {
    uuid: record.uuid,
    agentUUID: record.agent_uuid,
    version: record.version,
    config: await readRequiredAgentConfig(record.config_object_key)
  };
}

export async function findAgentVersions(
  inputs: Array<{ agentUUID: string; version: number }>,
  teamUUID: string
) {
  if (inputs.length === 0) {
    return [];
  }

  const requested = new Set(
    inputs.map((input) => `${input.agentUUID}:${input.version}`)
  );
  const entries = await listTeamAgentVersionEntries(teamUUID);
  const matched = entries
    .map((entry) => entry.value)
    .filter((record) =>
      requested.has(`${record.agent_uuid}:${record.version}`)
    );

  const configs = await Promise.all(
    matched.map((record) => readRequiredAgentConfig(record.config_object_key))
  );

  return matched.map((record, index) => ({
    uuid: record.uuid,
    agentUUID: record.agent_uuid,
    version: record.version,
    config: configs[index]
  }));
}

export async function findLatestAgentVersion(
  agentUUID: string,
  teamUUID: string
) {
  const entries = await listTeamAgentVersionEntries(teamUUID);
  const latest = entries
    .map((entry) => entry.value)
    .filter((record) => record.agent_uuid === agentUUID)
    .sort((left, right) => right.version - left.version)[0];

  if (!latest) {
    return null;
  }

  return {
    version: latest.version
  };
}

export async function listAgentsWithDraftConfigs(teamUUID: string) {
  const entries = await listTeamAgentEntries(teamUUID);
  const records = entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at);
  const configs = await Promise.all(
    records.map((record) =>
      loadAgentConfig(normalizeObjectKey(record.draft_object_key))
    )
  );

  return records.map((record, index) => ({
    uuid: record.uuid,
    name: record.name,
    draftConfig: configs[index]
  }));
}

export async function listAgentVersionsWithConfigs(teamUUID: string) {
  const entries = await listTeamAgentVersionEntries(teamUUID);
  const records = entries
    .map((entry) => entry.value)
    .sort((left, right) => left.created_at - right.created_at);
  const configs = await Promise.all(
    records.map((record) => readRequiredAgentConfig(record.config_object_key))
  );

  return records.map((record, index) => ({
    agentUUID: record.agent_uuid,
    version: record.version,
    config: configs[index]
  }));
}

export async function createAgentVersion(
  data: {
    uuid: string;
    agentUUID: string;
    version: number;
    config: AgentConfig;
    createdBy?: string;
    note?: string;
  },
  teamUUID: string
) {
  const now = Date.now();
  const objectKey = getVersionObjectKey(teamUUID, data.agentUUID, data.version);

  await uploadObjectJson(objectKey, data.config);
  await agentVersionStore.set(
    getAgentVersionKey(data.agentUUID, data.version),
    {
      team_uuid: teamUUID,
      uuid: data.uuid,
      agent_uuid: data.agentUUID,
      version: data.version,
      config_object_key: objectKey,
      created_by: data.createdBy ?? '',
      note: data.note ?? '',
      created_at: now
    }
  );

  return {
    uuid: data.uuid,
    agentUUID: data.agentUUID,
    version: data.version,
    config: data.config
  };
}

export async function publishAgentVersion(
  uuid: string,
  currentVersion: number,
  teamUUID: string
) {
  const record = await getRequiredStoredAgentByUUID(uuid, teamUUID);

  if (record.draft_object_key) {
    await deleteObject(record.draft_object_key).catch(() => undefined);
  }

  await agentStore.set(getAgentKey(uuid), {
    ...record,
    current_version: currentVersion,
    draft_object_key: '',
    updated_at: Date.now()
  });

  return {
    uuid,
    currentVersion
  };
}

export async function deleteAgentVersionsByAgentUUID(
  agentUUID: string,
  teamUUID: string
) {
  const entries = await listTeamAgentVersionEntries(teamUUID);
  const targets = entries.filter(
    (entry) => entry.value.agent_uuid === agentUUID
  );

  await Promise.all(
    targets.map((entry) =>
      deleteObject(entry.value.config_object_key).catch(() => undefined)
    )
  );
  await Promise.all(
    targets.map((entry) =>
      agentVersionStore.delete(
        getAgentVersionKey(entry.value.agent_uuid, entry.value.version)
      )
    )
  );
}

export async function deleteAgentByUUID(uuid: string, teamUUID: string) {
  const record = await getRequiredStoredAgentByUUID(uuid, teamUUID);
  const [bindings, knowledgeBindings] = await Promise.all([
    listAgentSkillBindingEntriesByAgentUUID(uuid, teamUUID),
    listAgentKnowledgeBindingEntriesByAgentUUID(uuid, teamUUID)
  ]);

  if (record.draft_object_key) {
    await deleteObject(record.draft_object_key).catch(() => undefined);
  }

  await Promise.all(
    bindings.map((binding) =>
      agentSkillBindingStore.delete(getAgentSkillBindingKey(binding.value.uuid))
    )
  );
  await Promise.all(
    knowledgeBindings.map((binding) =>
      agentKnowledgeBindingStore.delete(
        getAgentKnowledgeBindingKey(binding.value.uuid)
      )
    )
  );
  await agentStore.delete(getAgentKey(uuid));
}

export async function findAgentsByWorkspaceUUID(
  workspaceUUID: string,
  teamUUID: string
): Promise<Array<{ uuid: string; name: string }>> {
  const entries = await listTeamAgentEntries(teamUUID);

  return entries
    .map((entry) => entry.value)
    .filter(
      (record) =>
        normalizeWorkspaceUUID(record.workspace_uuid) === workspaceUUID
    )
    .map((record) => ({
      uuid: record.uuid,
      name: record.name
    }));
}

export async function findAgentsBySkillUUID(
  skillUUID: string,
  teamUUID: string
): Promise<Array<{ uuid: string; name: string }>> {
  const [bindings, entries] = await Promise.all([
    listAgentSkillBindingEntriesBySkillUUID(skillUUID, teamUUID),
    listTeamAgentEntries(teamUUID)
  ]);
  const boundAgentUUIDs = new Set(
    bindings.map((binding) => binding.value.agent_uuid)
  );

  return entries
    .map((entry) => entry.value)
    .filter((record) => boundAgentUUIDs.has(record.uuid))
    .map((record) => ({
      uuid: record.uuid,
      name: record.name
    }));
}

export async function findAgentsByKnowledgeSourceUUID(
  knowledgeSourceUUID: string,
  teamUUID: string
): Promise<Array<{ uuid: string; name: string }>> {
  const [bindings, entries] = await Promise.all([
    listAgentKnowledgeBindingEntriesByKnowledgeSourceUUID(
      knowledgeSourceUUID,
      teamUUID
    ),
    listTeamAgentEntries(teamUUID)
  ]);
  const agentUUIDs = new Set(
    bindings.map((binding) => binding.value.agent_uuid)
  );

  return entries
    .map((entry) => entry.value)
    .filter((record) => agentUUIDs.has(record.uuid))
    .map((record) => ({ uuid: record.uuid, name: record.name }));
}

export async function findAgentsByUUIDs(
  uuids: string[],
  teamUUID: string
): Promise<
  Array<{ uuid: string; name: string; currentVersion: number | null }>
> {
  if (uuids.length === 0) {
    return [];
  }

  const records = await Promise.all(
    uuids.map((uuid) => getStoredAgentByUUID(uuid, teamUUID))
  );

  return records.flatMap((record) =>
    record
      ? [
          {
            uuid: record.uuid,
            name: record.name,
            currentVersion: normalizeCurrentVersion(record.current_version)
          }
        ]
      : []
  );
}

export async function findDispatchAgentsByUUIDs(
  uuids: string[],
  teamUUID: string
): Promise<DispatchAgentRecord[]> {
  if (uuids.length === 0) {
    return [];
  }

  const records = await Promise.all(
    uuids.map((uuid) => getStoredAgentByUUID(uuid, teamUUID))
  );

  return records.flatMap((record) =>
    record
      ? [
          {
            uuid: record.uuid,
            name: record.name,
            currentVersion: normalizeCurrentVersion(record.current_version),
            executor: normalizeExecutor(
              record.executor_uuid,
              record.executor_name
            )
          }
        ]
      : []
  );
}
