import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from '../src/auth/service.ts';

test('AuthService loads access token from auth.json without reauthenticating', async () => {
  const connectCalls: unknown[] = [];
  const authService = new AuthService(
    {
      clientUUID: 'client-1',
      clientName: 'Agent Client',
      clientVersion: '1.0.0',
      serverBaseUrl: 'http://server.test',
      workingRoot: '/tmp/agent-client'
    },
    {
      readFile: async () =>
        JSON.stringify({
          clientUUID: 'client-1',
          clientName: 'Agent Client',
          accessToken: 'token-from-disk',
          issuedAt: '2025-01-01T00:00:00.000Z'
        }),
      connectToServer: async (...args) => {
        connectCalls.push(args);
        throw new Error('should not connect');
      }
    }
  );

  await authService.ensureAuthenticated();

  assert.equal(authService.getAccessTokenOrThrow(), 'token-from-disk');
  assert.equal(connectCalls.length, 0);
});

test('AuthService authenticates, polls until approved, and persists token', async () => {
  const sleepCalls: number[] = [];
  const pollCalls: Array<{ connectionRequestUUID: string; connectCode: string }> = [];
  const writes: Array<{ filePath: string; content: string }> = [];
  let pollAttempt = 0;

  const authService = new AuthService(
    {
      clientUUID: 'client-2',
      clientName: 'Agent Client',
      clientVersion: '1.0.0',
      serverBaseUrl: 'http://server.test',
      workingRoot: '/tmp/agent-client'
    },
    {
      readFile: async () => {
        throw new Error('missing auth file');
      },
      connectToServer: async (_serverBaseUrl, request) => {
        assert.equal(request.client.uuid, 'client-2');
        assert.equal(request.client.name, 'Agent Client');
        assert.equal(request.client.hostname, 'host-1');
        assert.equal(request.client.version, '1.0.0');
        assert.equal(request.connectCode, 'connect-code');

        return {
          connectionRequestUUID: 'request-1',
          status: 'pending_approval',
          pollAfterMs: 10
        };
      },
      pollServerConnection: async (_serverBaseUrl, request) => {
        pollCalls.push({
          connectionRequestUUID: request.connectionRequestUUID,
          connectCode: request.connectCode
        });
        pollAttempt += 1;

        if (pollAttempt === 1) {
          return {
            status: 'pending_approval',
            pollAfterMs: 20
          };
        }

        return {
          status: 'approved',
          accessToken: 'approved-token'
        };
      },
      getHostname: () => 'host-1',
      createConnectCode: () => 'connect-code',
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
      writeFile: async (filePath, content) => {
        writes.push({ filePath, content });
      }
    }
  );

  await authService.ensureAuthenticated();

  assert.deepEqual(sleepCalls, [10, 20]);
  assert.deepEqual(pollCalls, [
    {
      connectionRequestUUID: 'request-1',
      connectCode: 'connect-code'
    },
    {
      connectionRequestUUID: 'request-1',
      connectCode: 'connect-code'
    }
  ]);
  assert.equal(authService.getAccessTokenOrThrow(), 'approved-token');
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.filePath, '/tmp/agent-client/auth.json');
  assert.equal(
    JSON.parse(writes[0]?.content ?? '{}').accessToken,
    'approved-token'
  );
});

test('AuthService deduplicates concurrent authentication attempts', async () => {
  let connectCallCount = 0;
  let releasePoll: (() => void) | null = null;
  let markPollStarted: (() => void) | null = null;
  const pollStarted = new Promise<void>((resolve) => {
    markPollStarted = resolve;
  });

  const authService = new AuthService(
    {
      clientUUID: 'client-3',
      clientName: 'Agent Client',
      clientVersion: '1.0.0',
      serverBaseUrl: 'http://server.test',
      workingRoot: '/tmp/agent-client'
    },
    {
      readFile: async () => {
        throw new Error('missing auth file');
      },
      connectToServer: async () => {
        connectCallCount += 1;
        return {
          connectionRequestUUID: 'request-2',
          status: 'pending_approval',
          pollAfterMs: 0
        };
      },
      pollServerConnection: async () => {
        markPollStarted?.();
        await new Promise<void>((resolve) => {
          releasePoll = resolve;
        });

        return {
          status: 'approved',
          accessToken: 'concurrent-token'
        };
      },
      sleep: async () => {},
      writeFile: async () => {}
    }
  );

  const firstPromise = authService.ensureAuthenticated();
  const secondPromise = authService.ensureAuthenticated();

  await pollStarted;
  releasePoll?.();

  await Promise.all([firstPromise, secondPromise]);

  assert.equal(connectCallCount, 1);
  assert.equal(authService.getAccessTokenOrThrow(), 'concurrent-token');
});
