import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createKnowledgeSourceHandler,
  deleteKnowledgeSourceHandler,
  listKnowledgeSourcesHandler,
  updateKnowledgeSourceHandler
} from './controller.js';

export const knowledgeSourcesRoutes = new Hono();

knowledgeSourcesRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

knowledgeSourcesRoutes.get('/', listKnowledgeSourcesHandler);
knowledgeSourcesRoutes.post('/', createKnowledgeSourceHandler);
knowledgeSourcesRoutes.put('/:uuid', updateKnowledgeSourceHandler);
knowledgeSourcesRoutes.delete('/:uuid', deleteKnowledgeSourceHandler);
