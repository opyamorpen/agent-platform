import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkflowNodeConfigurationError } from '../src/modules/workflows/repository.ts';

test('workflow node configuration accepts legacy and version 1 bindings', () => {
  assert.equal(getWorkflowNodeConfigurationError('agent-uuid'), null);
  assert.equal(getWorkflowNodeConfigurationError('["agent-uuid"]'), null);
  assert.equal(
    getWorkflowNodeConfigurationError(
      JSON.stringify({ v: 1, a: 'agent-uuid', t: 'status-uuid', n: 'Done' })
    ),
    null
  );
});

test('workflow node configuration surfaces malformed and unknown bindings', () => {
  assert.equal(
    getWorkflowNodeConfigurationError('{invalid')?.code,
    'invalid_node_binding'
  );
  assert.match(
    getWorkflowNodeConfigurationError(JSON.stringify({ v: 2, a: 'agent-uuid' }))
      ?.message ?? '',
    /Unsupported/
  );
  assert.match(
    getWorkflowNodeConfigurationError(JSON.stringify({ v: 1, t: 'status-uuid' }))
      ?.message ?? '',
    /missing the Agent binding/
  );
  assert.match(
    getWorkflowNodeConfigurationError(JSON.stringify({ v: 1, a: 'agent-uuid', t: 'status-uuid' }))
      ?.message ?? '',
    /transition is incomplete/
  );
});
