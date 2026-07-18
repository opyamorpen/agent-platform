import { Hono } from 'hono';
import {
  approveAgentClientHandler,
  claimAgentClientTasksHandler,
  connectAgentClientHandler,
  downloadAgentClientSkillVersionHandler,
  getAgentClientTaskRuntimeEnvHandler,
  downloadAgentClientPreviousWorkspacePatchHandler,
  getAgentClientSkillsManifestHandler,
  listAgentClientsHandler,
  listSelectableAgentClientsHandler,
  pollAgentClientConnectionHandler,
  reportAgentClientTasksHandler,
  uploadAgentClientTaskAttachmentsHandler,
  uploadAgentClientTaskWorkspacePatchHandler,
  revokeAgentClientHandler
} from './controller.js';

export const agentClientsRoutes = new Hono();

agentClientsRoutes.post('/connect', connectAgentClientHandler);
agentClientsRoutes.post('/connect/poll', pollAgentClientConnectionHandler);
agentClientsRoutes.get('/skills/manifest', getAgentClientSkillsManifestHandler);
agentClientsRoutes.get(
  '/skills/:uuid/versions/:version/download',
  downloadAgentClientSkillVersionHandler
);
agentClientsRoutes.get('/options', listSelectableAgentClientsHandler);
agentClientsRoutes.get('/', listAgentClientsHandler);
agentClientsRoutes.post('/:uuid/approve', approveAgentClientHandler);
agentClientsRoutes.post('/:uuid/revoke', revokeAgentClientHandler);
agentClientsRoutes.post('/tasks/report', reportAgentClientTasksHandler);
agentClientsRoutes.post('/tasks/claim', claimAgentClientTasksHandler);
agentClientsRoutes.get('/tasks/:taskUUID/runtime-env', getAgentClientTaskRuntimeEnvHandler);
agentClientsRoutes.post(
  '/tasks/:taskUUID/attachments',
  uploadAgentClientTaskAttachmentsHandler
);
agentClientsRoutes.post(
  '/tasks/:taskUUID/workspace-patch',
  uploadAgentClientTaskWorkspacePatchHandler
);
agentClientsRoutes.get(
  '/tasks/:taskUUID/previous-patch',
  downloadAgentClientPreviousWorkspacePatchHandler
);
