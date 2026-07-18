import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { requireAdmin } from '../../lib/web-access.js';
import { InvalidGeneratedSkillError } from '../skill-generation/validation.js';
import { SkillConflictError } from '../skills/service.js';
import {
  createAssetOptimizationRunSchema,
  createShadowReplaySchema,
  dismissAssetCandidateSchema,
  mutateAssetCandidateSchema
} from './dto.js';
import {
  applyAssetCandidate,
  AssetOptimizationConflictError,
  AssetOptimizationNoSamplesError,
  AssetOptimizationNotFoundError,
  AssetOptimizationScriptReviewRequiredError,
  createManualAssetOptimization,
  dismissAssetCandidate,
  getAssetOptimizationRun,
  listAssetOptimizationRunSummaries
} from './service.js';
import {
  createCandidateShadowReplay,
  getCandidateShadowReplay,
  ShadowReplayConflictError,
  ShadowReplayNotFoundError
} from './shadow-replay-service.js';
import {
  AssetEffectNotFoundError,
  createCandidateRollbackDraft,
  getCandidateAssetEffect
} from '../asset-effects/service.js';

export async function getCandidateEffectHandler(c: Context) {
  try {
    const { teamUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await getCandidateAssetEffect(c.req.param('uuid') ?? '', teamUUID)
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function createRollbackDraftHandler(c: Context) {
  try {
    const { teamUUID, userUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await createCandidateRollbackDraft({
          candidateUUID: c.req.param('uuid') ?? '',
          teamUUID,
          userUUID
        })
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function createShadowReplayHandler(c: Context) {
  const parsed = createShadowReplaySchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      failure(
        'Invalid shadow replay payload',
        'asset_optimization.invalid_shadow_replay_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID, userUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await createCandidateShadowReplay({
          ...parsed.data,
          teamUUID,
          userUUID
        })
      ),
      202
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function getShadowReplayHandler(c: Context) {
  try {
    const { teamUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await getCandidateShadowReplay(c.req.param('uuid') ?? '', teamUUID)
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function listAssetOptimizationRunsHandler(c: Context) {
  const { teamUUID } = await requireAdmin(c.req);
  return c.json(success(await listAssetOptimizationRunSummaries(teamUUID)));
}

export async function getAssetOptimizationRunHandler(c: Context) {
  try {
    const { teamUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await getAssetOptimizationRun(c.req.param('uuid') ?? '', teamUUID)
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function createAssetOptimizationRunHandler(c: Context) {
  const parsed = createAssetOptimizationRunSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      failure(
        'Invalid asset optimization payload',
        'asset_optimization.invalid_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID, userUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await createManualAssetOptimization({
          ...parsed.data,
          teamUUID,
          userUUID
        })
      ),
      202
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function applyAssetCandidateHandler(c: Context) {
  const parsed = mutateAssetCandidateSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      failure(
        'Invalid candidate apply payload',
        'asset_optimization.invalid_apply_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID, userUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await applyAssetCandidate({
          uuid: c.req.param('uuid') ?? '',
          teamUUID,
          userUUID,
          ...parsed.data
        })
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

export async function dismissAssetCandidateHandler(c: Context) {
  const parsed = dismissAssetCandidateSchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json(
      failure(
        'Invalid candidate dismiss payload',
        'asset_optimization.invalid_dismiss_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID, userUUID } = await requireAdmin(c.req);
    return c.json(
      success(
        await dismissAssetCandidate({
          uuid: c.req.param('uuid') ?? '',
          teamUUID,
          userUUID,
          ...parsed.data
        })
      )
    );
  } catch (error) {
    return handleKnownError(c, error);
  }
}

function handleKnownError(c: Context, error: unknown) {
  if (error instanceof AssetEffectNotFoundError) {
    return c.json(
      failure(error.message, 'asset_optimization.effect_not_found'),
      404
    );
  }
  if (error instanceof ShadowReplayNotFoundError) {
    return c.json(
      failure(error.message, 'asset_optimization.shadow_replay_not_found'),
      404
    );
  }
  if (error instanceof ShadowReplayConflictError) {
    return c.json(
      failure(error.message, 'asset_optimization.shadow_replay_conflict'),
      409
    );
  }
  if (error instanceof AssetOptimizationNotFoundError) {
    return c.json(failure(error.message, 'asset_optimization.not_found'), 404);
  }
  if (
    error instanceof AssetOptimizationConflictError ||
    error instanceof SkillConflictError
  ) {
    return c.json(failure(error.message, 'asset_optimization.conflict'), 409);
  }
  if (error instanceof AssetOptimizationNoSamplesError) {
    return c.json(failure(error.message, 'asset_optimization.no_samples'), 400);
  }
  if (
    error instanceof AssetOptimizationScriptReviewRequiredError ||
    error instanceof InvalidGeneratedSkillError
  ) {
    return c.json(
      failure(
        error.message,
        error instanceof AssetOptimizationScriptReviewRequiredError
          ? 'asset_optimization.script_review_required'
          : 'asset_optimization.invalid_skill_files'
      ),
      400
    );
  }
  throw error;
}
