import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createSkillGenerationSessionHandler,
  deleteSkillGenerationSessionHandler,
  getSkillGenerationSessionHandler,
  listSkillGenerationSessionsHandler,
  publishSkillGenerationSessionHandler,
  streamGenerateSkillDraftHandler,
  streamSkillGenerationMessageHandler,
  updateSkillGenerationDraftHandler
} from './controller.js';

export const skillGenerationRoutes = new Hono();

skillGenerationRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

skillGenerationRoutes.get('/', listSkillGenerationSessionsHandler);
skillGenerationRoutes.post('/', createSkillGenerationSessionHandler);
skillGenerationRoutes.get('/:uuid', getSkillGenerationSessionHandler);
skillGenerationRoutes.delete('/:uuid', deleteSkillGenerationSessionHandler);
skillGenerationRoutes.post(
  '/:uuid/messages/stream',
  streamSkillGenerationMessageHandler
);
skillGenerationRoutes.post(
  '/:uuid/generate/stream',
  streamGenerateSkillDraftHandler
);
skillGenerationRoutes.put('/:uuid/draft', updateSkillGenerationDraftHandler);
skillGenerationRoutes.post(
  '/:uuid/publish',
  publishSkillGenerationSessionHandler
);
