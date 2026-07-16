import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createAgentHandler,
  deleteAgentHandler,
  duplicateAgentHandler,
  getAgentDraftHandler,
  listAgentsHandler,
  previewAgentPromptHandler,
  recommendAgentPromptHandler,
  publishAgentDraftHandler,
  saveAgentDraftHandler,
  updateAgentHandler
} from './controller.js';

export const agentsRoutes = new Hono();

agentsRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

agentsRoutes.get('/', listAgentsHandler);
agentsRoutes.post('/prompt-preview', previewAgentPromptHandler);
agentsRoutes.post('/prompt-recommendations/stream', recommendAgentPromptHandler);
agentsRoutes.post('/', createAgentHandler);
agentsRoutes.post('/:uuid/duplicate', duplicateAgentHandler);
agentsRoutes.patch('/:uuid', updateAgentHandler);
agentsRoutes.delete('/:uuid', deleteAgentHandler);
agentsRoutes.get('/:uuid/draft', getAgentDraftHandler);
agentsRoutes.put('/:uuid/draft', saveAgentDraftHandler);
agentsRoutes.post('/:uuid/publish', publishAgentDraftHandler);
