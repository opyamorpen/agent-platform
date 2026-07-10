import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createEntityStore,
  readObjectText,
  uploadObjectBuffer,
  waitForObjectTextMatch
} from '../src/lib/hosted-storage.ts';

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

test('local storage fallback stores entities and objects', async () => {
  const previousRoot = process.env.ONES_LOCAL_STORAGE_ROOT;
  const root = await mkdtemp(join(tmpdir(), 'ones-local-storage-'));
  process.env.ONES_LOCAL_STORAGE_ROOT = root;

  try {
    const store = createEntityStore<{ uuid: string; team_uuid: string }>('example');
    await store.set('item-a', { uuid: 'item-a', team_uuid: 'team-a' });
    await store.set('item-b', { uuid: 'item-b', team_uuid: 'team-b' });

    assert.deepEqual(await store.get('item-a'), {
      uuid: 'item-a',
      team_uuid: 'team-a'
    });
    assert.deepEqual(
      (await store.queryByIndexEqualTo('idx_team_uuid', 'team_uuid', 'team-a')).map(
        (entry) => entry.key
      ),
      ['item-a']
    );

    await uploadObjectBuffer(
      'object-key',
      Buffer.from('local object content', 'utf8'),
      'text/plain'
    );
    assert.equal(await readObjectText('object-key'), 'local object content');
  } finally {
    if (previousRoot === undefined) {
      delete process.env.ONES_LOCAL_STORAGE_ROOT;
    } else {
      process.env.ONES_LOCAL_STORAGE_ROOT = previousRoot;
    }

    await rm(root, { recursive: true, force: true });
  }
});
