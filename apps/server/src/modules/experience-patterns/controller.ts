import type { Context } from 'hono';
import { success } from '../../lib/api-response.js';
import { requireAppUser } from '../../lib/web-access.js';
import { getExperiencePatterns } from './service.js';

export async function listExperiencePatternsHandler(c: Context) {
  const { teamUUID } = await requireAppUser(c.req);
  return c.json(
    success(
      await getExperiencePatterns({
        teamUUID,
        agentUUID: c.req.query('agentUUID')?.trim() || null,
        workflowUUID: c.req.query('workflowUUID')?.trim() || null
      })
    )
  );
}
