import type { KnowledgeSource } from '@ones-ai-workflow/shared';
import type { OnesWebContext } from '../../ones/context.js';
import { createOnesOpenApiClient } from '../../ones/index.js';
import {
  findAgentsByKnowledgeSourceUUID,
  listAgentsWithDraftConfigs
} from '../agents/repository.js';
import type { KnowledgeSourceMutationDTO } from './dto.js';
import {
  createKnowledgeSource,
  deleteKnowledgeSource,
  findKnowledgeSource,
  findKnowledgeSourceBySpaceUUID,
  listKnowledgeSources,
  updateKnowledgeSource
} from './repository.js';

export class KnowledgeSourceNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Knowledge source not found: ${uuid}`);
    this.name = 'KnowledgeSourceNotFoundError';
  }
}

export class KnowledgeSourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeSourceConflictError';
  }
}

async function resolveSpace(spaceUUID: string, context: OnesWebContext) {
  const spaces = await (
    await createOnesOpenApiClient(context)
  ).listWikiSpaces();
  const space = spaces.find((item) => item.id === spaceUUID);
  if (!space) {
    throw new KnowledgeSourceNotFoundError(spaceUUID);
  }
  return space;
}

export async function getKnowledgeSources(
  teamUUID: string
): Promise<KnowledgeSource[]> {
  return listKnowledgeSources(teamUUID);
}

export async function createKnowledgeSourceRecord(
  payload: KnowledgeSourceMutationDTO,
  context: OnesWebContext
): Promise<KnowledgeSource> {
  const existing = await findKnowledgeSourceBySpaceUUID(
    payload.spaceUUID,
    context.teamUUID
  );
  if (existing) {
    throw new KnowledgeSourceConflictError(
      `Wiki space is already configured as knowledge source: ${existing.name}`
    );
  }

  const space = await resolveSpace(payload.spaceUUID, context);
  return createKnowledgeSource({
    teamUUID: context.teamUUID,
    name: payload.name,
    description: payload.description,
    spaceUUID: space.id,
    spaceName: space.title,
    homePageUUID: space.homePageID,
    status: payload.status,
    createdBy: context.userUUID
  });
}

export async function updateKnowledgeSourceRecord(
  uuid: string,
  payload: KnowledgeSourceMutationDTO,
  context: OnesWebContext
): Promise<KnowledgeSource> {
  const current = await findKnowledgeSource(uuid, context.teamUUID);
  if (!current) {
    throw new KnowledgeSourceNotFoundError(uuid);
  }

  const sameSpace = await findKnowledgeSourceBySpaceUUID(
    payload.spaceUUID,
    context.teamUUID
  );
  if (sameSpace && sameSpace.uuid !== uuid) {
    throw new KnowledgeSourceConflictError(
      `Wiki space is already configured as knowledge source: ${sameSpace.name}`
    );
  }

  const space = await resolveSpace(payload.spaceUUID, context);
  const updated = await updateKnowledgeSource(uuid, context.teamUUID, {
    name: payload.name,
    description: payload.description,
    spaceUUID: space.id,
    spaceName: space.title,
    homePageUUID: space.homePageID,
    status: payload.status
  });

  if (!updated) {
    throw new KnowledgeSourceNotFoundError(uuid);
  }
  return updated;
}

export async function removeKnowledgeSourceRecord(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const current = await findKnowledgeSource(uuid, teamUUID);
  if (!current) {
    throw new KnowledgeSourceNotFoundError(uuid);
  }

  const [draftAgents, publishedAgents] = await Promise.all([
    listAgentsWithDraftConfigs(teamUUID),
    findAgentsByKnowledgeSourceUUID(uuid, teamUUID)
  ]);
  const referenced =
    draftAgents.some((agent) =>
      agent.draftConfig?.knowledgeSourceUUIDs?.includes(uuid)
    ) || publishedAgents.length > 0;

  if (referenced) {
    throw new KnowledgeSourceConflictError(
      'Knowledge source is referenced by an Agent draft or published version'
    );
  }

  await deleteKnowledgeSource(uuid, teamUUID);
}
