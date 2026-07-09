import { Hono } from 'hono';
import { requireAdmin } from '../../lib/web-access.js';
import {
  createAppMemberHandler,
  deleteAppMemberHandler,
  listAppMembersHandler
} from './controller.js';

export const membersRoutes = new Hono();

membersRoutes.use('*', async (c, next) => {
  await requireAdmin(c.req);
  await next();
});

membersRoutes.get('/', listAppMembersHandler);
membersRoutes.post('/', createAppMemberHandler);
membersRoutes.delete('/:userUUID', deleteAppMemberHandler);
