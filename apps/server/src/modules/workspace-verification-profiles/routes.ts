import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createWorkspaceVerificationProfileHandler,
  deleteWorkspaceVerificationProfileHandler,
  listWorkspaceVerificationProfilesHandler,
  updateWorkspaceVerificationProfileHandler
} from './controller.js';

export const workspaceVerificationProfilesRoutes = new Hono();

workspaceVerificationProfilesRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

workspaceVerificationProfilesRoutes.get('/', listWorkspaceVerificationProfilesHandler);
workspaceVerificationProfilesRoutes.post('/', createWorkspaceVerificationProfileHandler);
workspaceVerificationProfilesRoutes.put('/:uuid', updateWorkspaceVerificationProfileHandler);
workspaceVerificationProfilesRoutes.delete('/:uuid', deleteWorkspaceVerificationProfileHandler);
