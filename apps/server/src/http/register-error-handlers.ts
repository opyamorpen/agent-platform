import type { Hono } from 'hono';
import { failure } from '../lib/api-response.js';
import { getLogger } from '../lib/logger.js';
import { WebSessionError } from '../lib/web-session.js';

const logger = getLogger('app.on-error');

export function registerErrorHandlers(app: Hono): void {
  app.onError((error, c) => {
    if (error instanceof WebSessionError) {
      return new Response(JSON.stringify(failure(error.message, error.code)), {
        status: error.status,
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      });
    }

    logger.error('[app.onError] unhandled error', {
      method: c.req.method,
      path: c.req.path,
      error
    });

    return c.json(
      failure('Internal server error', 'common.internal_server_error'),
      500
    );
  });
}
