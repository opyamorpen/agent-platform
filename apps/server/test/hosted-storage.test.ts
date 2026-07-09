import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForObjectTextMatch } from '../src/lib/hosted-storage.ts';

test('waitForObjectTextMatch retries until uploaded content becomes readable', async () => {
  const observedSleeps: number[] = [];
  const responses = [null, '{"status":"stale"}', '{"status":"ready"}'];

  await waitForObjectTextMatch('object-key', '{"status":"ready"}', {
    readObjectText: async () => responses.shift() ?? null,
    sleep: async (ms) => {
      observedSleeps.push(ms);
    },
    retryDelaysMs: [1, 2, 3]
  });

  assert.deepEqual(observedSleeps, [1, 2]);
});

test('waitForObjectTextMatch throws when uploaded content never becomes readable', async () => {
  const observedSleeps: number[] = [];

  await assert.rejects(
    () =>
      waitForObjectTextMatch('object-key', '{"status":"ready"}', {
        readObjectText: async () => null,
        sleep: async (ms) => {
          observedSleeps.push(ms);
        },
        retryDelaysMs: [1, 2]
      }),
    /Hosted object readback verification failed: object-key/
  );

  assert.deepEqual(observedSleeps, [1, 2]);
});
