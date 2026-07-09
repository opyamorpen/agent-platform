import assert from 'node:assert/strict';
import test from 'node:test';
import { CodexHomeReporter } from '../src/codex-home/reporter.ts';
import type { CodexHomeService } from '../src/codex-home/service.ts';

test('CodexHomeReporter logs all home statuses immediately and on interval', async () => {
  const logs: string[] = [];
  const scheduledCallbacks: Array<() => void> = [];
  const expectedReport = [
    '[codex-home] status summary',
    '+-----------------------+---------------+-------------+--------------+--------------+-------------------+',
    '| home                  | account       | status      | 5h remaining | 7d remaining | detail            |',
    '+-----------------------+---------------+-------------+--------------+--------------+-------------------+',
    '| /Users/liwei/.codex-a | a@example.com | available   | 80%          | 40%          | -                 |',
    '| /Users/liwei/.codex-b | unknown       | unavailable | -            | -            | Invalid auth file |',
    '+-----------------------+---------------+-------------+--------------+--------------+-------------------+'
  ].join('\n');
  const reporter = new CodexHomeReporter(
    {
      async getHomeStatuses() {
        return [
          {
            homePath: '/Users/liwei/.codex-a',
            account: 'a@example.com',
            available: true,
            remaining5hPercent: 80,
            remaining7dPercent: 40,
            reason: null
          },
          {
            homePath: '/Users/liwei/.codex-b',
            account: 'unknown',
            available: false,
            remaining5hPercent: null,
            remaining7dPercent: null,
            reason: 'Invalid auth file'
          }
        ];
      }
    } as CodexHomeService,
    {
      intervalMs: 60_000
    },
    {
      setInterval: ((callback: () => void) => {
        scheduledCallbacks.push(callback);
        return {
          unref() {}
        };
      }) as typeof setInterval,
      logInfo: (message) => {
        logs.push(message);
      },
      logWarn: (message) => {
        logs.push(`warn:${message}`);
      }
    }
  );

  reporter.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(logs, [expectedReport]);

  logs.length = 0;
  scheduledCallbacks[0]?.();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(logs, [expectedReport]);
});
