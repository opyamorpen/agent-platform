import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createModelProfileHandler,
  deleteModelProfileHandler,
  listModelProfilesHandler,
  updateModelProfileHandler
} from './controller.js';

export const modelProfilesRoutes = new Hono();

modelProfilesRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

modelProfilesRoutes.get('/', listModelProfilesHandler);
modelProfilesRoutes.post('/', createModelProfileHandler);
modelProfilesRoutes.put('/:uuid', updateModelProfileHandler);
modelProfilesRoutes.delete('/:uuid', deleteModelProfileHandler);
