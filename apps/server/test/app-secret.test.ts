import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceCryptoSecretValue,
  resolveWorkspaceCryptoSecretValue
} from '../src/lib/app-secret.ts';

test('buildWorkspaceCryptoSecretValue deterministically derives a 32-byte secret', () => {
  const derivedSecret = buildWorkspaceCryptoSecretValue(
    Buffer.from('shared-secret-value', 'utf8').toString('base64')
  );

  assert.equal(Buffer.from(derivedSecret, 'base64').length, 32);
  assert.equal(
    derivedSecret,
    buildWorkspaceCryptoSecretValue(
      Buffer.from('shared-secret-value', 'utf8').toString('base64')
    )
  );
});

test('resolveWorkspaceCryptoSecretValue initializes and persists the secret when empty', async () => {
  let storedSecret: string | null = null;

  const resolvedSecret = await resolveWorkspaceCryptoSecretValue({
    loadSecret: async () => storedSecret,
    saveSecret: async (nextSecret) => {
      storedSecret = nextSecret;
    },
    resolveBootstrapSharedSecret: async () =>
      Buffer.from('bootstrap-secret', 'utf8').toString('base64')
  });

  assert.equal(resolvedSecret, storedSecret);
  assert.equal(Buffer.from(resolvedSecret, 'base64').length, 32);
});

test('resolveWorkspaceCryptoSecretValue keeps the persisted secret once initialized', async () => {
  const persistedSecret = Buffer.alloc(32, 7).toString('base64');
  let saveCallCount = 0;

  const resolvedSecret = await resolveWorkspaceCryptoSecretValue({
    loadSecret: async () => persistedSecret,
    saveSecret: async () => {
      saveCallCount += 1;
    },
    resolveBootstrapSharedSecret: async () =>
      Buffer.from('new-bootstrap-secret', 'utf8').toString('base64')
  });

  assert.equal(resolvedSecret, persistedSecret);
  assert.equal(saveCallCount, 0);
});
