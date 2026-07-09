import { Hono } from 'hono';
import { registerErrorHandlers } from './http/register-error-handlers.js';
import { registerMiddlewares } from './http/register-middlewares.js';
import { registerRoutes } from './http/register-routes.js';
import { registerWebModulesFallback } from './http/web-modules.js';

export function createApp() {
  const app = new Hono();

  registerMiddlewares(app);
  registerRoutes(app);
  registerWebModulesFallback(app);
  registerErrorHandlers(app);

  return app;
}
