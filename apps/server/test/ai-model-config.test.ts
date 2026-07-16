import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPublicHTTPSURL,
  normalizeBaseURL
} from '../src/modules/ai-model-config/service.js';

test('normalizes a model base URL without changing its API prefix', () => {
  assert.equal(
    normalizeBaseURL('https://api.example.com/v1///'),
    'https://api.example.com/v1'
  );
});

test('rejects non-HTTPS, credentialed, queried, and private model URLs', async () => {
  await assert.rejects(() => assertPublicHTTPSURL('http://api.example.com/v1'));
  await assert.rejects(() =>
    assertPublicHTTPSURL('https://user:pass@api.example.com/v1')
  );
  await assert.rejects(() =>
    assertPublicHTTPSURL('https://api.example.com/v1?token=x')
  );
  await assert.rejects(() => assertPublicHTTPSURL('https://127.0.0.1/v1'));
  await assert.rejects(() => assertPublicHTTPSURL('https://192.168.1.2/v1'));
  await assert.rejects(() => assertPublicHTTPSURL('https://[::1]/v1'));
});
