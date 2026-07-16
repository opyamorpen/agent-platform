import type { Hono } from 'hono';
import { failure, success } from '../lib/api-response.js';
import {
  customPageEntriesHandler,
  disabledCallbackHandler,
  enabledCallbackHandler,
  installCallbackHandler,
  uninstalledCallbackHandler
} from '../modules/app/controller.js';
import { agentsRoutes } from '../modules/agents/routes.js';
import { agentClientsRoutes } from '../modules/agent-clients/routes.js';
import { agentWorkspacesRoutes } from '../modules/agent-workspaces/routes.js';
import { executionsRoutes } from '../modules/executions/routes.js';
import { membersRoutes } from '../modules/members/routes.js';
import { onesRoutes } from '../modules/ones/routes.js';
import { skillsRoutes } from '../modules/skills/routes.js';
import { workflowsRoutes } from '../modules/workflows/routes.js';
import { aiModelConfigRoutes } from '../modules/ai-model-config/routes.js';
import { skillGenerationRoutes } from '../modules/skill-generation/routes.js';
import { knowledgeSourcesRoutes } from '../modules/knowledge-sources/routes.js';

export function registerRoutes(app: Hono): void {
  app.get('/health', (c) =>
    c.json({
      ok: true
    })
  );

  app.get('/health_check', (c) =>
    c.json({
      ok: true
    })
  );

  app.get('/api/health', (c) =>
    c.json(
      success({
        service: 'ones-ai-workflow-server',
        status: 'ok'
      })
    )
  );

  app.post('/install_cb', installCallbackHandler);
  app.post('/enabled_cb', enabledCallbackHandler);
  app.post('/disabled_cb', disabledCallbackHandler);
  app.post('/uninstalled_cb', uninstalledCallbackHandler);
  app.post('/custom_page_entries', customPageEntriesHandler);

  app.route('/api/workflows', workflowsRoutes);
  app.route('/api/agents', agentsRoutes);
  app.route('/api/skills', skillsRoutes);
  app.route('/api/agent-clients', agentClientsRoutes);
  app.route('/api/agent-workspaces', agentWorkspacesRoutes);
  app.route('/api/executions', executionsRoutes);
  app.route('/api/ones', onesRoutes);
  app.route('/api/members', membersRoutes);
  app.route('/api/ai-model-config', aiModelConfigRoutes);
  app.route('/api/skill-generation-sessions', skillGenerationRoutes);
  app.route('/api/knowledge-sources', knowledgeSourcesRoutes);

  app.notFound((c) =>
    c.json(failure('Route not found', 'common.route_not_found'), 404)
  );
}
