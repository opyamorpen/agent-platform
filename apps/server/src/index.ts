import { serve } from '@hono/node-server';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initializeInstallationSecretsCache } from './lib/app-auth.js';
import { getLogger } from './lib/logger.js';
import { startWorkflowExecutionPoller } from './modules/executions/poller.js';
import { startOrganizationModelExecutor } from './modules/executions/organization-model-executor.js';

const logger = getLogger('server.index');

async function bootstrap(): Promise<void> {
  await initializeInstallationSecretsCache();

  const app = createApp();
  startWorkflowExecutionPoller();
  startOrganizationModelExecutor();

  serve(
    {
      fetch: app.fetch,
      port: env.PORT
    },
    (info) => {
      logger.info(`Server listening on http://localhost:${info.port}`);
    }
  );
}

void bootstrap().catch((error) => {
  logger.fatal('[server.index] failed to bootstrap server', {
    error
  });
  process.exitCode = 1;
});
