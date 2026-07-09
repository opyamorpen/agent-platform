import * as onesNodeSdk from '@ones-open/node-sdk';
import type {
  OnesInternalApiConfig
} from '../ones/internal-api/types.js';
import type { OnesOpenApiConfig } from '../ones/open-api/types.js';
import { OnesConfigError } from '../ones/errors.js';
import { resolveCurrentInstallationInfo } from './installation-info.js';
import type {
  OnesInternalApiContext,
  OnesOpenApiContext
} from '../ones/context.js';

type OnesOAuthModule = {
  oauth: {
    getAccessTokenByInstallationInfo(
      installationInfo: {
        installation_id: string;
        shared_secret: string;
        ones_base_url: string;
      },
      userID?: string
    ): Promise<string>;
  };
};

const { oauth } = onesNodeSdk as unknown as OnesOAuthModule;
const OPEN_API_ACCESS_TOKEN_TTL_MS = 5 * 1000;

type AccessTokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

const openApiAccessTokenCache = new Map<string, AccessTokenCacheEntry>();
const openApiAccessTokenPromises = new Map<string, Promise<string>>();

function getRequiredTeamUUID(teamUUID: string): string {
  const normalized = teamUUID.trim();

  if (!normalized) {
    throw new OnesConfigError('team_uuid request header is required');
  }

  return normalized;
}

function getOpenApiAccessTokenCacheKey(
  installationID: string,
  context: OnesOpenApiContext
): string {
  return [
    installationID,
    getRequiredTeamUUID(context.teamUUID),
    context.userUUID?.trim() || 'app'
  ].join(':');
}

async function resolveOpenApiAccessToken(
  installationInfo: {
    installation_id: string;
    shared_secret: string;
    ones_base_url: string;
  },
  context: OnesOpenApiContext,
  options: {
    forceRefresh?: boolean;
  } = {}
): Promise<string> {
  const cacheKey = getOpenApiAccessTokenCacheKey(
    installationInfo.installation_id,
    context
  );
  const now = Date.now();

  if (options.forceRefresh) {
    openApiAccessTokenCache.delete(cacheKey);
  } else {
    const cached = openApiAccessTokenCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return cached.accessToken;
    }

    const currentPromise = openApiAccessTokenPromises.get(cacheKey);

    if (currentPromise) {
      return currentPromise;
    }
  }

  const requestPromise = oauth
    .getAccessTokenByInstallationInfo(
      installationInfo,
      context.userUUID?.trim() || undefined
    )
    .then((accessToken) => {
      if (openApiAccessTokenPromises.get(cacheKey) === requestPromise) {
        openApiAccessTokenCache.set(cacheKey, {
          accessToken,
          expiresAt: Date.now() + OPEN_API_ACCESS_TOKEN_TTL_MS
        });
      }

      return accessToken;
    })
    .finally(() => {
      if (openApiAccessTokenPromises.get(cacheKey) === requestPromise) {
        openApiAccessTokenPromises.delete(cacheKey);
      }
    });

  openApiAccessTokenPromises.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function resolveOpenApiConfig(
  context: OnesOpenApiContext,
  options: {
    forceRefresh?: boolean;
  } = {}
): Promise<OnesOpenApiConfig> {
  const installationInfo = await resolveCurrentInstallationInfo();

  return {
    baseUrl: installationInfo.ones_base_url,
    teamId: getRequiredTeamUUID(context.teamUUID),
    accessToken: await resolveOpenApiAccessToken(
      installationInfo,
      context,
      options
    )
  };
}

export async function resolveInternalApiConfig(
  context: OnesInternalApiContext
): Promise<OnesInternalApiConfig> {
  const installationInfo = await resolveCurrentInstallationInfo();

  return {
    baseUrl: installationInfo.ones_base_url,
    teamId: getRequiredTeamUUID(context.teamUUID),
    authorization: context.authorizationHeader
  };
}
