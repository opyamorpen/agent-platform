import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import { listExperiencePatternsHandler } from './controller.js';

export const experiencePatternsRoutes = new Hono();

experiencePatternsRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

experiencePatternsRoutes.get('/', listExperiencePatternsHandler);
