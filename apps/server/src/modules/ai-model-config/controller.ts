import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { testAIModelConnection } from '../ai-model/client.js';
import { updateAIModelConfigSchema } from './dto.js';
import {
  AIModelNotConfiguredError,
  getAIModelConfig,
  getAIModelConfigStatus,
  UnsafeAIModelBaseURLError,
  updateAIModelConfig
} from './service.js';

export async function getAIModelConfigStatusHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getAIModelConfigStatus(teamUUID)));
}

export async function getAIModelConfigHandler(c: Context) {
  const { teamUUID } = await getWebSession(c.req);
  return c.json(success(await getAIModelConfig(teamUUID)));
}

export async function updateAIModelConfigHandler(c: Context) {
  const result = updateAIModelConfigSchema.safeParse(
    await c.req.json().catch(() => null)
  );

  if (!result.success) {
    return c.json(
      failure('Invalid AI model config', 'ai_model_config.invalid_payload'),
      400
    );
  }

  try {
    const { teamUUID, userUUID } = await getWebSession(c.req);
    return c.json(
      success(await updateAIModelConfig(result.data, teamUUID, userUUID))
    );
  } catch (error) {
    if (error instanceof UnsafeAIModelBaseURLError) {
      return c.json(
        failure(error.message, 'ai_model_config.unsafe_base_url'),
        400
      );
    }
    throw error;
  }
}

export async function testAIModelConfigHandler(c: Context) {
  try {
    const { teamUUID } = await getWebSession(c.req);
    await testAIModelConnection(teamUUID);
    return c.json(success({ ok: true }));
  } catch (error) {
    if (error instanceof AIModelNotConfiguredError) {
      return c.json(
        failure(error.message, 'ai_model_config.not_configured'),
        409
      );
    }
    return c.json(
      failure(
        error instanceof Error ? error.message : 'AI model connection failed',
        'ai_model_config.test_failed'
      ),
      502
    );
  }
}
