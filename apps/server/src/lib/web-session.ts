import type { HonoRequest } from 'hono';
import { getLogger } from './logger.js';
import { OnesRequestError } from '../ones/errors.js';
import { OnesInternalApiClient } from '../ones/internal-api/client.js';
import { resolveCurrentInstallationInfo } from './installation-info.js';

const logger = getLogger('web-session');
const TEAM_UUID_HEADER_NAMES = ['x-ones-team-uuid', 'team_uuid'] as const;
const webSessionCache = new WeakMap<object, Promise<WebSession>>();

export interface WebSession {
  teamUUID: string;
  userUUID: string;
  authorizationHeader: string;
}

export class WebSessionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'WebSessionError';
  }
}

export class WebSessionUnauthorizedError extends WebSessionError {
  constructor(message = 'User is not logged in', code = 'auth.user_not_logged_in') {
    super(message, 401, code);
    this.name = 'WebSessionUnauthorizedError';
  }
}

export class WebSessionInvalidError extends WebSessionError {
  constructor(message: string, status = 400, code?: string) {
    super(message, status, code);
    this.name = 'WebSessionInvalidError';
  }
}

export function getAuthorizationHeader(req: Pick<HonoRequest, 'header'>): string {
  const authorizationHeader = req.header('authorization')?.trim();

  if (!authorizationHeader) {
    throw new WebSessionUnauthorizedError(
      'Missing Authorization header',
      'auth.missing_authorization_header'
    );
  }

  return authorizationHeader;
}

function getSelectedTeamUUID(req: Pick<HonoRequest, 'header'>): string {
  for (const headerName of TEAM_UUID_HEADER_NAMES) {
    const teamUUID = req.header(headerName)?.trim();

    if (teamUUID) {
      return teamUUID;
    }
  }

  throw new WebSessionInvalidError(
    'team_uuid request header is required',
    400,
    'auth.team_uuid_required'
  );
}

async function loadWebSession(
  req: Pick<HonoRequest, 'header'>
): Promise<WebSession> {
  const authorizationHeader = getAuthorizationHeader(req);
  const teamUUID = getSelectedTeamUUID(req);
  const installationInfo = await resolveCurrentInstallationInfo();

  try {
    const tokenInfo = await new OnesInternalApiClient({
      baseUrl: installationInfo.ones_base_url,
      teamId: teamUUID,
      authorization: authorizationHeader
    }).getTokenInfo();

    if (!tokenInfo.teams.some((team) => team.uuid === teamUUID)) {
      throw new WebSessionInvalidError(
        `Selected team is not accessible: ${teamUUID}`,
        403,
        'auth.selected_team_not_accessible'
      );
    }

    return {
      teamUUID,
      userUUID: tokenInfo.user.uuid,
      authorizationHeader
    };
  } catch (error) {
    if (error instanceof WebSessionError) {
      throw error;
    }

    if (error instanceof OnesRequestError && error.status === 401) {
      throw new WebSessionUnauthorizedError();
    }

    logger.error('[web-session] failed to resolve web session', {
      error
    });
    throw error;
  }
}

export async function getWebSession(
  req: Pick<HonoRequest, 'header'>
): Promise<WebSession> {
  const cached = webSessionCache.get(req as object);

  if (cached) {
    return cached;
  }

  const sessionPromise = loadWebSession(req);
  webSessionCache.set(req as object, sessionPromise);
  return sessionPromise;
}
