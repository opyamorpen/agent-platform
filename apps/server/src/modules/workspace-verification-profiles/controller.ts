import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { requireAdmin } from '../../lib/web-access.js';
import { workspaceVerificationProfileMutationSchema } from './dto.js';
import {
  createWorkspaceVerificationProfileRecord,
  getWorkspaceVerificationProfiles,
  removeWorkspaceVerificationProfileRecord,
  updateWorkspaceVerificationProfileRecord,
  WorkspaceVerificationProfileConflictError,
  WorkspaceVerificationProfileNotFoundError,
  WorkspaceVerificationProfileValidationError
} from './service.js';

function handleError(c: Context, error: unknown) {
  if (error instanceof WorkspaceVerificationProfileNotFoundError) {
    return c.json(failure(error.message, 'verification_profiles.not_found'), 404);
  }
  if (error instanceof WorkspaceVerificationProfileValidationError) {
    return c.json(failure(error.message, 'verification_profiles.invalid'), 400);
  }
  if (error instanceof WorkspaceVerificationProfileConflictError) {
    return c.json(failure(error.message, 'verification_profiles.conflict'), 409);
  }
  throw error;
}

export async function listWorkspaceVerificationProfilesHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getWorkspaceVerificationProfiles(teamUUID)));
}

export async function createWorkspaceVerificationProfileHandler(c: Context) {
  const result = workspaceVerificationProfileMutationSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!result.success) {
    return c.json(failure('Invalid verification profile payload', 'verification_profiles.invalid'), 400);
  }
  try {
    const { teamUUID, userUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await createWorkspaceVerificationProfileRecord(
          result.data,
          teamUUID,
          userUUID
        )
      ),
      201
    );
  } catch (error) {
    return handleError(c, error);
  }
}

export async function updateWorkspaceVerificationProfileHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const result = workspaceVerificationProfileMutationSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!uuid || !result.success) {
    return c.json(failure('Invalid verification profile payload', 'verification_profiles.invalid'), 400);
  }
  try {
    const { teamUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await updateWorkspaceVerificationProfileRecord(
          uuid,
          result.data,
          teamUUID
        )
      )
    );
  } catch (error) {
    return handleError(c, error);
  }
}

export async function deleteWorkspaceVerificationProfileHandler(c: Context) {
  const uuid = c.req.param('uuid');
  if (!uuid) {
    return c.json(failure('Verification profile uuid is required'), 400);
  }
  try {
    const { teamUUID } = await requireAdmin(c.req);
    await removeWorkspaceVerificationProfileRecord(uuid, teamUUID);
    return c.json(success({ uuid }));
  } catch (error) {
    return handleError(c, error);
  }
}
