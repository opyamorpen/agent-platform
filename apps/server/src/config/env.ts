import * as dotenv from 'dotenv';
import { z } from 'zod';
import { resolveWorkspacePath } from '../lib/runtime-path.js';

dotenv.config({
  path: process.env.ONES_HOSTED_ENV_PATH ?? resolveWorkspacePath('.env')
});

const envSchema = z.object({
  PORT: z.coerce
    .number()
    .default(Number(process.env.ONES_HOSTED_PORT ?? 3001)),
  ONES_HOSTED_APP_ID: z.string().min(1).optional(),
  ONES_HOSTED_ENV_PATH: z.string().min(1).optional(),
  ONES_HOSTED_MODULES_ROOT: z.string().min(1).optional(),
  WORKFLOW_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  AGENT_TASK_STALE_AFTER_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'off'])
    .default('info')
});

export const env = envSchema.parse(process.env);
