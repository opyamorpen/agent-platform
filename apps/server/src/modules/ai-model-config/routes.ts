import { Hono } from 'hono';
import { requireAdmin, requireAppUser } from '../../lib/web-access.js';
import {
  getAIModelConfigHandler,
  getAIModelConfigStatusHandler,
  testAIModelConfigHandler,
  updateAIModelConfigHandler
} from './controller.js';

export const aiModelConfigRoutes = new Hono();

aiModelConfigRoutes.get('/status', async (c) => {
  await requireAppUser(c.req);
  return getAIModelConfigStatusHandler(c);
});

aiModelConfigRoutes.use('*', async (c, next) => {
  await requireAdmin(c.req);
  await next();
});

aiModelConfigRoutes.get('/', getAIModelConfigHandler);
aiModelConfigRoutes.put('/', updateAIModelConfigHandler);
aiModelConfigRoutes.post('/test', testAIModelConfigHandler);
