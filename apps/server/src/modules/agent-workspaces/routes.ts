import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createAgentWorkspaceHandler,
  createWorkspaceCredentialHandler,
  createRepositoryHandler,
  deleteAgentWorkspaceHandler,
  deleteWorkspaceCredentialHandler,
  deleteRepositoryHandler,
  listAgentWorkspacesHandler,
  listWorkspaceCredentialsHandler,
  regenerateAgentWorkspaceKeyHandler,
  updateAgentWorkspaceHandler,
  updateAgentWorkspaceAuthHandler,
  updateRepositoryHandler
} from './controller.js';

export const agentWorkspacesRoutes = new Hono();

agentWorkspacesRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

agentWorkspacesRoutes.get('/', listAgentWorkspacesHandler);
agentWorkspacesRoutes.post('/', createAgentWorkspaceHandler);
agentWorkspacesRoutes.put('/:uuid', updateAgentWorkspaceHandler);
agentWorkspacesRoutes.delete('/:uuid', deleteAgentWorkspaceHandler);
agentWorkspacesRoutes.put('/:uuid/auth', updateAgentWorkspaceAuthHandler);
agentWorkspacesRoutes.post('/:uuid/auth/ssh/generate', regenerateAgentWorkspaceKeyHandler);
agentWorkspacesRoutes.get('/:uuid/credentials', listWorkspaceCredentialsHandler);
agentWorkspacesRoutes.post('/:uuid/credentials', createWorkspaceCredentialHandler);
agentWorkspacesRoutes.delete(
  '/:uuid/credentials/:envName',
  deleteWorkspaceCredentialHandler
);
agentWorkspacesRoutes.post('/:uuid/repositories', createRepositoryHandler);
agentWorkspacesRoutes.put('/repositories/:uuid', updateRepositoryHandler);
agentWorkspacesRoutes.delete('/repositories/:uuid', deleteRepositoryHandler);
