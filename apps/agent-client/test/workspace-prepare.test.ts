import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDetachedWorktree,
  isMissingRegisteredWorktreeError
} from '../src/workspace/prepare.ts';

test('isMissingRegisteredWorktreeError matches git stale worktree registration message', () => {
  assert.equal(
    isMissingRegisteredWorktreeError(
      new Error(
        "fatal: '/tmp/worktree' is a missing but already registered worktree"
      )
    ),
    true
  );
  assert.equal(
    isMissingRegisteredWorktreeError(new Error('fatal: unrelated git failure')),
    false
  );
});

test('addDetachedWorktree prunes before adding a detached worktree', async () => {
  const calls: Array<{ cwd: string; args: string[] }> = [];

  await addDetachedWorktree(
    '/tmp/source-repo',
    '/tmp/task/workspace/repo',
    async (cwd, args) => {
      calls.push({
        cwd,
        args
      });

      return {
        stdout: '',
        stderr: ''
      };
    }
  );

  assert.deepEqual(calls, [
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'prune']
    },
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'add', '--detach', '/tmp/task/workspace/repo', 'HEAD']
    }
  ]);
});

test('addDetachedWorktree prunes and retries when git reports stale registered worktree', async () => {
  const calls: Array<{ cwd: string; args: string[] }> = [];
  let addAttempt = 0;

  await addDetachedWorktree(
    '/tmp/source-repo',
    '/tmp/task/workspace/repo',
    async (cwd, args) => {
      calls.push({
        cwd,
        args
      });

      if (args[0] === 'worktree' && args[1] === 'add') {
        addAttempt += 1;

        if (addAttempt === 1) {
          throw new Error(
            "Preparing worktree (detached HEAD deadbeef)\n" +
              "fatal: '/tmp/task/workspace/repo' is a missing but already registered worktree;\n" +
              "use 'add -f' to override, or 'prune' or 'remove' to clear"
          );
        }
      }

      return {
        stdout: '',
        stderr: ''
      };
    }
  );

  assert.deepEqual(calls, [
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'prune']
    },
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'add', '--detach', '/tmp/task/workspace/repo', 'HEAD']
    },
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'prune']
    },
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'add', '--detach', '/tmp/task/workspace/repo', 'HEAD']
    }
  ]);
});

test('addDetachedWorktree does not retry unrelated git errors', async () => {
  const calls: Array<{ cwd: string; args: string[] }> = [];

  await assert.rejects(
    () =>
      addDetachedWorktree(
        '/tmp/source-repo',
        '/tmp/task/workspace/repo',
        async (cwd, args) => {
          calls.push({
            cwd,
            args
          });

          if (args[0] === 'worktree' && args[1] === 'add') {
            throw new Error('fatal: invalid reference: HEAD');
          }

          return {
            stdout: '',
            stderr: ''
          };
        }
      ),
    /invalid reference: HEAD/
  );

  assert.deepEqual(calls, [
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'prune']
    },
    {
      cwd: '/tmp/source-repo',
      args: ['worktree', 'add', '--detach', '/tmp/task/workspace/repo', 'HEAD']
    }
  ]);
});
