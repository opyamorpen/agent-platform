import type { HonoRequest } from 'hono';
import type { AppAccessRole } from '@ones-ai-workflow/shared';
import jwt from 'jsonwebtoken';
import { findAppMemberByUserUUID } from '../modules/members/repository.js';
import { createOnesInternalAuthClient } from '../ones/index.js';
import { OnesRequestError } from '../ones/errors.js';
import {
  getWebSession,
  type WebSession,
  WebSessionInvalidError,
  WebSessionUnauthorizedError
} from './web-session.js';

const REQUIRED_ORGANIZATION_PERMISSION = 'org_plugin_administrator';
const APP_MEMBER_REQUIRED_MESSAGE =
  '当前账号不是当前团队的 AI 工作流成员，请联系管理员添加。';
const ADMIN_REQUIRED_MESSAGE = '当前页面仅管理员可访问。';
const ADMIN_STATUS_CACHE_TTL_MS = 60 * 1000;

const webAccessCache = new WeakMap<object, Promise<WebAccess>>();
const adminStatusCache = new Map<string, { isAdmin: boolean; expiresAt: number }>();

export interface WebAccess extends WebSession {
  role: AppAccessRole;
  isAdmin: boolean;
}

function resolveOrganizationUUID(authorizationHeader: string): string {
  const token = authorizationHeader.replace(/^Bearer\s+/iu, '').trim();

  if (!token) {
    throw new WebSessionUnauthorizedError(
      'Missing Authorization header',
      'auth.missing_authorization_header'
    );
  }

  const payload = jwt.decode(token);

  if (!payload || typeof payload !== 'object') {
    throw new WebSessionUnauthorizedError(
      'Invalid Authorization token',
      'auth.invalid_authorization_token'
    );
  }

  const organizationUUID =
    typeof payload.org_uuid === 'string' ? payload.org_uuid.trim() : '';

  if (!organizationUUID) {
    throw new WebSessionInvalidError(
      'Authorization token missing organization identifier',
      401,
      'auth.organization_identifier_missing'
    );
  }

  return organizationUUID;
}

export async function resolveOrganizationAdminStatus(
  authorizationHeader: string
): Promise<boolean> {
  const cached = adminStatusCache.get(authorizationHeader);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.isAdmin;
  }

  try {
    const client = await createOnesInternalAuthClient(authorizationHeader);
    const organizationUUID = resolveOrganizationUUID(authorizationHeader);
    const permissions = await client.getOrganizationPermissions(organizationUUID);
    const isAdmin = permissions.evaluatedPermissions.some(
      (permission) => permission.permission === REQUIRED_ORGANIZATION_PERMISSION
    );

    adminStatusCache.set(authorizationHeader, {
      isAdmin,
      expiresAt: Date.now() + ADMIN_STATUS_CACHE_TTL_MS
    });

    return isAdmin;
  } catch (error) {
    if (error instanceof OnesRequestError && error.status === 403) {
      adminStatusCache.set(authorizationHeader, {
        isAdmin: false,
        expiresAt: Date.now() + ADMIN_STATUS_CACHE_TTL_MS
      });
      return false;
    }

    throw error;
  }
}

async function loadWebAccess(
  req: Pick<HonoRequest, 'header'>
): Promise<WebAccess> {
  const session = await getWebSession(req);
  const [isAdmin, member] = await Promise.all([
    resolveOrganizationAdminStatus(session.authorizationHeader),
    findAppMemberByUserUUID(session.teamUUID, session.userUUID)
  ]);
  const role: AppAccessRole = isAdmin ? 'admin' : member ? 'member' : 'none';

  return {
    ...session,
    role,
    isAdmin
  };
}

export async function getWebAccess(
  req: Pick<HonoRequest, 'header'>
): Promise<WebAccess> {
  const cached = webAccessCache.get(req as object);

  if (cached) {
    return cached;
  }

  const accessPromise = loadWebAccess(req);
  webAccessCache.set(req as object, accessPromise);
  return accessPromise;
}

export async function requireAppUser(
  req: Pick<HonoRequest, 'header'>
): Promise<WebAccess> {
  const access = await getWebAccess(req);

  if (access.role === 'none') {
    throw new WebSessionInvalidError(
      APP_MEMBER_REQUIRED_MESSAGE,
      403,
      'access.not_app_member'
    );
  }

  return access;
}

export async function requireAdmin(
  req: Pick<HonoRequest, 'header'>
): Promise<WebAccess> {
  const access = await getWebAccess(req);

  if (!access.isAdmin) {
    throw new WebSessionInvalidError(
      ADMIN_REQUIRED_MESSAGE,
      403,
      'access.admin_only'
    );
  }

  return access;
}
