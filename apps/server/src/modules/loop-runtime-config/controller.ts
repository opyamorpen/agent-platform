import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { updateLoopRuntimeConfigSchema } from './dto.js';
import { getLoopRuntimeConfig, updateLoopRuntimeConfig } from './service.js';

export async function getLoopRuntimeConfigHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getLoopRuntimeConfig(teamUUID)));
}

export async function updateLoopRuntimeConfigHandler(c: Context) {
  const result = updateLoopRuntimeConfigSchema.safeParse(
    await c.req.json().catch(() => null)
  );

  if (!result.success) {
    return c.json(
      failure(
        'Invalid loop runtime config',
        'loop_runtime_config.invalid_payload'
      ),
      400
    );
  }

  const { teamUUID, userUUID } = await getWebSession(c.req);
  return c.json(
    success(await updateLoopRuntimeConfig(result.data, teamUUID, userUUID))
  );
}
