import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createSkillHandler,
  deleteSkillHandler,
  downloadSkillHandler,
  downloadSkillVersionHandler,
  getSkillDownloadUrlHandler,
  getSkillsManifestHandler,
  getSkillVersionDownloadUrlHandler,
  listSkillsHandler,
  uploadSkillVersionHandler
} from './controller.js';

export const skillsRoutes = new Hono();

skillsRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

skillsRoutes.get('/manifest', getSkillsManifestHandler);
skillsRoutes.get('/', listSkillsHandler);
skillsRoutes.post('/', createSkillHandler);
skillsRoutes.delete('/:uuid', deleteSkillHandler);
skillsRoutes.post('/:uuid/versions', uploadSkillVersionHandler);
skillsRoutes.get('/:uuid/versions/:version/download-url', getSkillVersionDownloadUrlHandler);
skillsRoutes.get('/:uuid/versions/:version/download', downloadSkillVersionHandler);
skillsRoutes.get('/:uuid/download-url', getSkillDownloadUrlHandler);
skillsRoutes.get('/:uuid/download', downloadSkillHandler);
