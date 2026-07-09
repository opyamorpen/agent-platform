import assert from 'node:assert/strict';
import test from 'node:test';
import { generateWorkspaceSshKeyPair } from '../src/modules/agent-workspaces/ssh-key.ts';

test('generateWorkspaceSshKeyPair returns OpenSSH ed25519 keys', async () => {
  const workspaceUUID = 'workspace-123';
  const keyPair = await generateWorkspaceSshKeyPair(workspaceUUID);

  assert.match(keyPair.privateKey, /^-----BEGIN OPENSSH PRIVATE KEY-----\n/);
  assert.match(keyPair.privateKey, /\n-----END OPENSSH PRIVATE KEY-----\n$/);
  assert.match(
    keyPair.publicKey,
    new RegExp(`^ssh-ed25519 [A-Za-z0-9+/=]+ workspace:${workspaceUUID}$`)
  );
});
