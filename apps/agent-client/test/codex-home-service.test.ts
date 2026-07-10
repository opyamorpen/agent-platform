import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CodexHomeService,
  getCodexHomeRetryDelayMs
} from '../src/codex-home/service.ts';

test('CodexHomeService selects the available home with the lowest usage', async () => {
  const fetchCalls: string[] = [];
  const service = new CodexHomeService(
    ['/Users/liwei/.codex-a', '/Users/liwei/.codex-b'],
    {
      readFile: async (filePath) =>
        JSON.stringify({
          tokens: {
            access_token: String(filePath).includes('.codex-a') ? 'token-a' : 'token-b',
            account_id: String(filePath).includes('.codex-a') ? 'account-a' : 'account-b'
          }
        }),
      fetch: async (_input, init) => {
        const accountId = String(
          (init?.headers as Record<string, string>)['ChatGPT-Account-Id']
        );
        fetchCalls.push(accountId);

        return new Response(
          JSON.stringify({
            email: accountId === 'account-a' ? 'a@example.com' : 'b@example.com',
            rate_limit: {
              allowed: true,
              limit_reached: false,
              primary_window: {
                used_percent: accountId === 'account-a' ? 48 : 12
              },
              secondary_window: {
                used_percent: accountId === 'account-a' ? 74 : 15
              }
            }
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }
    }
  );

  const result = await service.selectHome();

  assert.deepEqual(fetchCalls.sort(), ['account-a', 'account-b']);
  assert.deepEqual(result, {
    kind: 'selected',
    homePath: '/Users/liwei/.codex-b',
    message:
      '[codex-home] selected home: /Users/liwei/.codex-b (5h remaining 88%, 7d remaining 85%)'
  });
});

test('CodexHomeService returns home statuses with account and remaining quota', async () => {
  const service = new CodexHomeService(
    ['/Users/liwei/.codex-a', '/Users/liwei/.codex-b'],
    {
      readFile: async (filePath) =>
        JSON.stringify({
          tokens: {
            access_token: String(filePath).includes('.codex-a') ? 'token-a' : 'token-b',
            account_id: String(filePath).includes('.codex-a') ? 'account-a' : 'account-b'
          }
        }),
      fetch: async (_input, init) => {
        const accountId = String(
          (init?.headers as Record<string, string>)['ChatGPT-Account-Id']
        );

        return new Response(
          JSON.stringify(
            accountId === 'account-a'
              ? {
                  email: 'a@example.com',
                  rate_limit: {
                    allowed: true,
                    limit_reached: false,
                    primary_window: { used_percent: 40 },
                    secondary_window: { used_percent: 75 }
                  }
                }
              : {
                  account_id: 'account-b',
                  rate_limit: {
                    allowed: false,
                    limit_reached: true,
                    primary_window: { used_percent: 100 },
                    secondary_window: { used_percent: 95 }
                  }
                }
          ),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }
    }
  );

  const result = await service.getHomeStatuses();

  assert.deepEqual(result, [
    {
      homePath: '/Users/liwei/.codex-a',
      account: 'a@example.com',
      available: true,
      remaining5hPercent: 60,
      remaining7dPercent: 25,
      reason: null
    },
    {
      homePath: '/Users/liwei/.codex-b',
      account: 'account-b',
      available: false,
      remaining5hPercent: 0,
      remaining7dPercent: 5,
      reason: 'rate limited'
    }
  ]);
});

test('CodexHomeService defers when no home is currently available', async () => {
  const service = new CodexHomeService(['/Users/liwei/.codex-a'], {
    readFile: async () =>
      JSON.stringify({
        tokens: {
          access_token: 'token-a',
          account_id: 'account-a'
        }
      }),
    fetch: async () =>
      new Response(
        JSON.stringify({
          rate_limit: {
            allowed: false,
            limit_reached: true
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
  });

  const result = await service.selectHome();

  assert.deepEqual(result, {
    kind: 'deferred',
    message: '[codex-home] no available home'
  });
});

test('getCodexHomeRetryDelayMs backs off to a maximum of five minutes', () => {
  assert.equal(getCodexHomeRetryDelayMs(1), 5_000);
  assert.equal(getCodexHomeRetryDelayMs(2), 10_000);
  assert.equal(getCodexHomeRetryDelayMs(6), 160_000);
  assert.equal(getCodexHomeRetryDelayMs(7), 300_000);
  assert.equal(getCodexHomeRetryDelayMs(99), 300_000);
});
