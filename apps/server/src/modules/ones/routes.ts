import { Hono } from 'hono';
import { requireAppUser } from '../../lib/web-access.js';
import {
  getOnesAccessHandler,
  getOnesTokenInfoHandler,
  listOnesFieldsHandler,
  listOnesIssueStatusesHandler,
  listOnesIssueTypesHandler,
  listOnesProjectsHandler,
  listOnesWikiSpacesHandler,
  searchOnesUsersHandler
} from './controller.js';

export const onesRoutes = new Hono();

onesRoutes.get('/token-info', getOnesTokenInfoHandler);
onesRoutes.get('/access', getOnesAccessHandler);
onesRoutes.use('*', async (c, next) => {
  await requireAppUser(c.req);
  await next();
});
onesRoutes.get('/fields', listOnesFieldsHandler);
onesRoutes.get('/projects', listOnesProjectsHandler);
onesRoutes.get('/issue-types', listOnesIssueTypesHandler);
onesRoutes.get('/issue-statuses', listOnesIssueStatusesHandler);
onesRoutes.get('/wiki/spaces', listOnesWikiSpacesHandler);
onesRoutes.get('/users/search', searchOnesUsersHandler);
