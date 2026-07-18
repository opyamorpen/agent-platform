import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  deleteDispatchedIssueHandler,
  downloadIssueAgentExecutionWorkspacePatchHandler,
  getDispatchedIssueHandler,
  getIssueAgentExecutionHistoryHandler,
  getIssueExecutionHistoryHandler,
  listDispatchedIssueExecutionHistoriesHandler,
  listDispatchedIssuesHandler,
  retryIssueAgentExecutionHistoryHandler
} from './controller.js';

export const executionsRoutes = new Hono();

executionsRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});

executionsRoutes.get('/issues', listDispatchedIssuesHandler);
executionsRoutes.get('/issues/:uuid', getDispatchedIssueHandler);
executionsRoutes.delete('/issues/:uuid', deleteDispatchedIssueHandler);
executionsRoutes.get('/issues/:uuid/histories', listDispatchedIssueExecutionHistoriesHandler);
executionsRoutes.get('/histories/:uuid', getIssueExecutionHistoryHandler);
executionsRoutes.get('/agent-histories/:uuid', getIssueAgentExecutionHistoryHandler);
executionsRoutes.post('/agent-histories/:uuid/retry', retryIssueAgentExecutionHistoryHandler);
executionsRoutes.get(
  '/agent-histories/:uuid/workspace-patch',
  downloadIssueAgentExecutionWorkspacePatchHandler
);
