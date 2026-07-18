import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentConfig, AgentExecutionTarget } from '@ones-ai-workflow/shared';
import { agentConfigSchema } from '../src/modules/agents/dto.js';
import { canClaimAgentExecutionTarget } from '../src/modules/agent-clients/service.js';
import { buildOrganizationModelPrompt } from '../src/modules/executions/organization-model-executor.js';

function createConfig(executionTarget: AgentExecutionTarget): AgentConfig {
  return {
    description: '',
    prompt: 'task',
    inputs: [],
    outputs: [],
    knowledgeSourceUUIDs: [],
    acceptancePolicy: {
      criteria: [],
      knowledgeRequirement: 'optional',
      verificationProfileUUIDs: []
    },
    executionTarget
  };
}

test('organization model tasks are only claimable by the server executor', () => {
  const config = createConfig({ mode: 'organization_model' });

  assert.equal(
    canClaimAgentExecutionTarget(config, { mode: 'organization_model' }),
    true
  );
  assert.equal(
    canClaimAgentExecutionTarget(config, {
      mode: 'agent_client',
      clientUUID: 'client-a'
    }),
    false
  );
});

test('specific Agent Client tasks only match the configured client UUID', () => {
  const config = createConfig({
    mode: 'agent_client',
    clientUUID: 'client-a',
    clientName: 'Client A'
  });

  assert.equal(
    canClaimAgentExecutionTarget(config, {
      mode: 'agent_client',
      clientUUID: 'client-a'
    }),
    true
  );
  assert.equal(
    canClaimAgentExecutionTarget(config, {
      mode: 'agent_client',
      clientUUID: 'client-b'
    }),
    false
  );
  assert.equal(
    canClaimAgentExecutionTarget(config, { mode: 'organization_model' }),
    false
  );
});

test('legacy Agent configs remain claimable by any external Client', () => {
  const config = createConfig({
    mode: 'agent_client',
    clientUUID: null,
    clientName: null
  });

  assert.equal(
    canClaimAgentExecutionTarget(config, {
      mode: 'agent_client',
      clientUUID: 'client-a'
    }),
    true
  );
  assert.equal(
    canClaimAgentExecutionTarget(config, { mode: 'organization_model' }),
    false
  );
});

test('new Agent configs default to the organization model', () => {
  const parsed = agentConfigSchema.parse({
    description: '',
    prompt: 'task',
    inputs: [],
    outputs: []
  });

  assert.deepEqual(parsed.executionTarget, { mode: 'organization_model' });
});

test('Agent Client execution target requires UUID and name together', () => {
  const parsed = agentConfigSchema.safeParse({
    description: '',
    prompt: 'task',
    inputs: [],
    outputs: [],
    executionTarget: {
      mode: 'agent_client',
      clientUUID: 'client-a',
      clientName: null
    }
  });

  assert.equal(parsed.success, false);
});

test('organization model prompt remains unchanged without selected Skills', async () => {
  const prompt = await buildOrganizationModelPrompt(
    {
      taskUUID: 'task-a',
      agent: { uuid: 'agent-a', name: 'Agent A' },
      sourceWorkspace: null,
      skillUUIDs: [],
      executeOption: {},
      prompt: 'rendered prompt'
    },
    'team-a'
  );

  assert.equal(prompt, 'rendered prompt');
});
