import type { RefObject } from '@ones-ai-workflow/shared';
import type { OnesOpenApiContext } from './context.js';
import { createOnesOpenApiClient } from './index.js';

const CACHE_TTL_MS = 60 * 1000;
const PAGE_LIMIT = 100;

type CacheEntry = {
  expiresAt: number;
  value: RefObject[];
};

const projectsCache = new Map<string, CacheEntry>();
const issueTypesCache = new Map<string, CacheEntry>();
const issueStatusesCache = new Map<string, CacheEntry>();

const projectsPromises = new Map<string, Promise<RefObject[]>>();
const issueTypesPromises = new Map<string, Promise<RefObject[]>>();
const issueStatusesPromises = new Map<string, Promise<RefObject[]>>();

async function listAllPages<T extends { id: string; name: string }>(
  fetchPage: (cursor?: string) => Promise<{
    list: T[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor?: string;
    };
  }>
): Promise<RefObject[]> {
  const items: RefObject[] = [];
  let cursor: string | undefined;

  while (true) {
    const page = await fetchPage(cursor);

    items.push(
      ...page.list.map((item) => ({
        uuid: item.id,
        name: item.name
      }))
    );

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) {
      break;
    }

    cursor = page.pageInfo.endCursor;
  }

  return items;
}

function getCacheKey(context: OnesOpenApiContext): string {
  return `${context.teamUUID}:${context.userUUID ?? 'app'}`;
}

async function withCache(
  cacheRef: 'projects' | 'issueTypes' | 'issueStatuses',
  context: OnesOpenApiContext,
  loader: () => Promise<RefObject[]>
): Promise<RefObject[]> {
  const now = Date.now();
  const cacheKey = getCacheKey(context);
  const cacheMap = {
    projects: projectsCache,
    issueTypes: issueTypesCache,
    issueStatuses: issueStatusesCache
  };
  const promiseMap = {
    projects: projectsPromises,
    issueTypes: issueTypesPromises,
    issueStatuses: issueStatusesPromises
  };

  const cached = cacheMap[cacheRef].get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const currentPromise = promiseMap[cacheRef].get(cacheKey);

  if (currentPromise) {
    return currentPromise;
  }

  const requestPromise = loader()
    .then((value) => {
      cacheMap[cacheRef].set(cacheKey, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS
      });

      return value;
    })
    .finally(() => {
      promiseMap[cacheRef].delete(cacheKey);
    });

  promiseMap[cacheRef].set(cacheKey, requestPromise);
  return requestPromise;
}

export async function listProjects(context: OnesOpenApiContext): Promise<RefObject[]> {
  return withCache('projects', context, async () => {
    const client = await createOnesOpenApiClient(context);
    return listAllPages((cursor) =>
      client.listProjects({
        limit: PAGE_LIMIT,
        cursor
      })
    );
  });
}

export async function listIssueTypes(context: OnesOpenApiContext): Promise<RefObject[]> {
  return withCache('issueTypes', context, async () => {
    const client = await createOnesOpenApiClient(context);
    return listAllPages((cursor) =>
      client.listIssueTypes({
        limit: PAGE_LIMIT,
        cursor
      })
    );
  });
}

export async function listIssueStatuses(context: OnesOpenApiContext): Promise<RefObject[]> {
  return withCache('issueStatuses', context, async () => {
    const client = await createOnesOpenApiClient(context);
    return listAllPages((cursor) =>
      client.listIssueStatuses({
        limit: PAGE_LIMIT,
        cursor
      })
    );
  });
}
