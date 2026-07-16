import type { Context } from 'hono';
import type { AppAccess } from '@ones-ai-workflow/shared';
import { z } from 'zod';
import { failure, success } from '../../lib/api-response.js';
import { getLogger } from '../../lib/logger.js';
import { getWebAccess } from '../../lib/web-access.js';
import {
  getAuthorizationHeader,
  getWebSession
} from '../../lib/web-session.js';
import {
  OnesConfigError,
  OnesRequestError,
  OnesResponseError
} from '../../ones/errors.js';
import {
  getOnesFields,
  getOnesIssueStatuses,
  getOnesIssueTypes,
  getOnesProjects,
  getOnesTokenInfo,
  searchOnesUsers,
  getOnesWikiSpaces
} from './service.js';
import { requireAdmin } from '../../lib/web-access.js';

const logger = getLogger('ones.controller');
const searchOnesUsersQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).optional()
});

function handleOnesError(c: Context, error: unknown) {
  if (error instanceof OnesConfigError) {
    logger.error('[ones.controller] config error', {
      method: c.req.method,
      path: c.req.path,
      message: error.message
    });
    return c.json(failure(error.message, 'ones.config_error'), 500);
  }

  if (error instanceof OnesRequestError) {
    const status =
      error.status === 401 || error.status === 403 ? error.status : 502;

    logger.error('[ones.controller] request error', {
      method: c.req.method,
      path: c.req.path,
      message: error.message,
      status: error.status,
      url: error.url,
      responseBody: error.responseBody ?? null
    });
    return c.json(failure(error.message, 'ones.request_error'), status);
  }

  if (error instanceof OnesResponseError) {
    logger.error('[ones.controller] response error', {
      method: c.req.method,
      path: c.req.path,
      message: error.message,
      code: error.code ?? null,
      data: error.data ?? null
    });
    return c.json(failure(error.message, 'ones.response_error'), 502);
  }

  throw error;
}

export async function listOnesFieldsHandler(c: Context) {
  try {
    const session = await getWebSession(c.req);
    return c.json(success(await getOnesFields(session)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}

export async function getOnesTokenInfoHandler(c: Context) {
  try {
    const authorizationHeader = getAuthorizationHeader(c.req);
    return c.json(success(await getOnesTokenInfo(authorizationHeader)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}

export async function getOnesAccessHandler(c: Context) {
  const access = await getWebAccess(c.req);
  const response: AppAccess = {
    role: access.role,
    isAdmin: access.isAdmin
  };

  return c.json(success(response));
}

export async function listOnesProjectsHandler(c: Context) {
  try {
    const session = await getWebSession(c.req);
    return c.json(success(await getOnesProjects(session)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}

export async function listOnesIssueTypesHandler(c: Context) {
  try {
    const session = await getWebSession(c.req);
    return c.json(success(await getOnesIssueTypes(session)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}

export async function listOnesIssueStatusesHandler(c: Context) {
  try {
    const session = await getWebSession(c.req);
    return c.json(success(await getOnesIssueStatuses(session)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}

export async function searchOnesUsersHandler(c: Context) {
  const queryResult = searchOnesUsersQuerySchema.safeParse({
    keyword: c.req.query('keyword'),
    limit: c.req.query('limit'),
    cursor: c.req.query('cursor')
  });

  if (!queryResult.success) {
    return c.json(
      failure('Invalid user search query', 'ones.invalid_user_search_query'),
      400
    );
  }

  try {
    const session = await getWebSession(c.req);
    return c.json(success(await searchOnesUsers(session, queryResult.data)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}

export async function listOnesWikiSpacesHandler(c: Context) {
  try {
    const session = await requireAdmin(c.req);
    return c.json(success(await getOnesWikiSpaces(session)));
  } catch (error) {
    return handleOnesError(c, error);
  }
}
