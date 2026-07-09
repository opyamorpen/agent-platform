import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { createAppMemberSchema } from './dto.js';
import {
  AppMemberConflictError,
  AppMemberNotFoundError,
  createAppMember,
  getAppMemberSummaries,
  removeAppMember
} from './service.js';

export async function listAppMembersHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getAppMemberSummaries(teamUUID)));
}

export async function createAppMemberHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = createAppMemberSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure('Invalid app member payload', 'members.invalid_payload'),
      400
    );
  }

  try {
    const session = await getWebSession(c.req);
    return c.json(
      success(
        await createAppMember({
          teamUUID: session.teamUUID,
          createdBy: session.userUUID,
          ...result.data
        })
      ),
      201
    );
  } catch (error) {
    if (error instanceof AppMemberConflictError) {
      return c.json(failure(error.message, 'members.conflict'), 409);
    }

    throw error;
  }
}

export async function deleteAppMemberHandler(c: Context) {
  const userUUID = c.req.param('userUUID');

  if (!userUUID) {
    return c.json(
      failure('Member userUUID is required', 'members.user_uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeAppMember(teamUUID, userUUID);
    return c.json(success(true));
  } catch (error) {
    if (error instanceof AppMemberNotFoundError) {
      return c.json(failure(error.message, 'members.not_found'), 404);
    }

    throw error;
  }
}
