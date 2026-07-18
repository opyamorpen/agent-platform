import { Hono } from 'hono';
import { requireAdmin } from '../../lib/web-access.js';
import {
  applyAssetCandidateHandler,
  createAssetOptimizationRunHandler,
  dismissAssetCandidateHandler,
  getAssetOptimizationRunHandler,
  listAssetOptimizationRunsHandler
} from './controller.js';

export const assetOptimizationsRoutes = new Hono();

assetOptimizationsRoutes.use('*', async (c, next) => {
  await requireAdmin(c.req);
  await next();
});

assetOptimizationsRoutes.get('/runs', listAssetOptimizationRunsHandler);
assetOptimizationsRoutes.post('/runs', createAssetOptimizationRunHandler);
assetOptimizationsRoutes.get('/runs/:uuid', getAssetOptimizationRunHandler);
assetOptimizationsRoutes.post(
  '/candidates/:uuid/apply',
  applyAssetCandidateHandler
);
assetOptimizationsRoutes.post(
  '/candidates/:uuid/dismiss',
  dismissAssetCandidateHandler
);
