import type { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';

export function registerMiddlewares(app: Hono): void {
  app.use('*', honoLogger());
}
