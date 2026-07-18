import { Hono } from 'hono';
import { requireAdmin, requireAppUser } from '../../lib/web-access.js';
import {
  getLoopRuntimeConfigHandler,
  updateLoopRuntimeConfigHandler
} from './controller.js';

export const loopRuntimeConfigRoutes = new Hono();

loopRuntimeConfigRoutes.get('/', async (c) => {
  await requireAppUser(c.req);
  return getLoopRuntimeConfigHandler(c);
});

loopRuntimeConfigRoutes.put('/', async (c) => {
  await requireAdmin(c.req);
  return updateLoopRuntimeConfigHandler(c);
});
