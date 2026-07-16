import type { OnesWebContext } from '../../ones/context.js';
import { listFields } from '../../ones/field.js';
import {
  createOnesInternalAuthClient,
  createOnesOpenApiClient
} from '../../ones/index.js';
import type { OnesInternalTokenInfo } from '../../ones/internal-api/types.js';
import {
  listIssueStatuses,
  listIssueTypes,
  listProjects
} from '../../ones/ref-object.js';
import type {
  OnesUserSummary,
  WikiSpaceSummary
} from '@ones-ai-workflow/shared';

export async function getOnesFields(context: OnesWebContext) {
  return listFields(context);
}

export async function getOnesTokenInfo(authorizationHeader: string) {
  const client = await createOnesInternalAuthClient(authorizationHeader);
  return client.getTokenInfo() as Promise<OnesInternalTokenInfo>;
}

export async function getOnesProjects(context: OnesWebContext) {
  return listProjects(context);
}

export async function getOnesIssueTypes(context: OnesWebContext) {
  return listIssueTypes(context);
}

export async function getOnesIssueStatuses(context: OnesWebContext) {
  return listIssueStatuses(context);
}

export function mapSearchableOnesUsers(
  users: readonly {
    id: string;
    name: string;
    email?: string;
    staffID?: string;
  }[]
): OnesUserSummary[] {
  return users.flatMap((user) => {
    const email = user.email?.trim();

    if (!email) {
      return [];
    }

    return [
      {
        uuid: user.id,
        name: user.name,
        email,
        staffID: user.staffID ?? null
      }
    ];
  });
}

export async function searchOnesUsers(
  context: OnesWebContext,
  request: {
    keyword?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<OnesUserSummary[]> {
  const result = await (
    await createOnesOpenApiClient(context)
  ).searchUsers(request);

  return mapSearchableOnesUsers(result.list);
}

export async function getOnesWikiSpaces(
  context: OnesWebContext
): Promise<WikiSpaceSummary[]> {
  const spaces = await (
    await createOnesOpenApiClient(context)
  ).listWikiSpaces();
  return spaces.map((space) => ({
    uuid: space.id,
    name: space.title,
    description: space.description,
    homePageUUID: space.homePageID
  }));
}
