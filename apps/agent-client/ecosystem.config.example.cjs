const path = require('node:path');

const releaseRoot = '/opt/ones-ai-workflow/current';
const appRoot = path.join(releaseRoot, 'apps/agent-client');

module.exports = {
  apps: [
    {
      name: 'agent-client-a',
      cwd: appRoot,
      script: 'dist/index.js',
      interpreter: 'node',
      env: {
        AGENT_CLIENT_UUID: 'mac-agent-client-a',
        AGENT_CLIENT_NAME: 'Mac Agent Client A',
        AGENT_CLIENT_VERSION: '0.1.0',
        AGENT_CLIENT_SERVER_BASE_URL: 'https://server-a.example.com',
        AGENT_CLIENT_CONCURRENCY: '1',
        AGENT_CLIENT_WORKING_ROOT:
          '/opt/ones-ai-workflow/instances/agent-client-a/data',
        AGENT_CLIENT_LOG_LEVEL: 'info'
      }
    },
    {
      name: 'agent-client-b',
      cwd: appRoot,
      script: 'dist/index.js',
      interpreter: 'node',
      env: {
        AGENT_CLIENT_UUID: 'mac-agent-client-b',
        AGENT_CLIENT_NAME: 'Mac Agent Client B',
        AGENT_CLIENT_VERSION: '0.1.0',
        AGENT_CLIENT_SERVER_BASE_URL: 'https://server-b.example.com',
        AGENT_CLIENT_CONCURRENCY: '1',
        AGENT_CLIENT_WORKING_ROOT:
          '/opt/ones-ai-workflow/instances/agent-client-b/data',
        AGENT_CLIENT_LOG_LEVEL: 'info'
      }
    }
  ]
};
