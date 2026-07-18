import { Hono } from 'hono';
import { requireAdmin } from '../../lib/web-access.js';
import {
  applyAssetCandidateHandler,
  createAssetOptimizationRunHandler,
  dismissAssetCandidateHandler,
  createShadowReplayHandler,
  getShadowReplayHandler,
  getCandidateEffectHandler,
  createRollbackDraftHandler,
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
assetOptimizationsRoutes.post('/shadow-replays', createShadowReplayHandler);
assetOptimizationsRoutes.get('/shadow-replays/:uuid', getShadowReplayHandler);
assetOptimizationsRoutes.get('/runs/:uuid', getAssetOptimizationRunHandler);
assetOptimizationsRoutes.get(
  '/candidates/:uuid/effect',
  getCandidateEffectHandler
);
assetOptimizationsRoutes.post(
  '/candidates/:uuid/rollback-draft',
  createRollbackDraftHandler
);
assetOptimizationsRoutes.post(
  '/candidates/:uuid/apply',
  applyAssetCandidateHandler
);
assetOptimizationsRoutes.post(
  '/candidates/:uuid/dismiss',
  dismissAssetCandidateHandler
);
