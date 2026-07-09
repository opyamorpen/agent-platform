import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  createWorkflowNodeHandler,
  createWorkflowHandler,
  deleteWorkflowNodeHandler,
  deleteWorkflowHandler,
  getWorkflowHandler,
  listWorkflowNodesHandler,
  listWorkflowsHandler,
  updateWorkflowNodeHandler,
  updateWorkflowHandler
} from './controller.js';

export const workflowsRoutes = new Hono();

workflowsRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

workflowsRoutes.get('/', listWorkflowsHandler);
workflowsRoutes.get('/:uuid', getWorkflowHandler);
workflowsRoutes.get('/:uuid/nodes', listWorkflowNodesHandler);
workflowsRoutes.post('/', createWorkflowHandler);
workflowsRoutes.post('/:uuid/nodes', createWorkflowNodeHandler);
workflowsRoutes.put('/:uuid', updateWorkflowHandler);
workflowsRoutes.put('/nodes/:uuid', updateWorkflowNodeHandler);
workflowsRoutes.delete('/:uuid', deleteWorkflowHandler);
workflowsRoutes.delete('/nodes/:uuid', deleteWorkflowNodeHandler);
