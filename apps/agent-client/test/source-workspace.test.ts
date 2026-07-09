import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureTaskSourceWorkspace } from '../src/workspace/source.ts';

const execFileAsync = promisify(execFile);

test('ensureTaskSourceWorkspace accepts origin URLs rewritten by git insteadOf rules', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'agent-client-source-'));
  const sourceWorkspacesRoot = path.join(tempRoot, 'source-workspaces');
  const repoPath = path.join(
    sourceWorkspacesRoot,
    'workspace-1',
    'repos',
    'plugin-runtime-manager'
  );

  try {
    await mkdir(repoPath, { recursive: true });
    await execGit(repoPath, ['init']);
    await execGit(repoPath, [
      'remote',
      'add',
      'origin',
      'https://github.com/BangWork/plugin-runtime-manager.git'
    ]);
    await execGit(repoPath, [
      'config',
      'url.git@github.com:.insteadOf',
      'https://github.com/'
    ]);

    const rawRemoteUrl = await execGit(repoPath, [
      'config',
      '--get',
      'remote.origin.url'
    ]);
    const effectiveRemoteUrl = await execGit(repoPath, [
      'remote',
      'get-url',
      'origin'
    ]);

    assert.equal(
      rawRemoteUrl.trim(),
      'https://github.com/BangWork/plugin-runtime-manager.git'
    );
    assert.equal(
      effectiveRemoteUrl.trim(),
      'git@github.com:BangWork/plugin-runtime-manager.git'
    );

    await assert.doesNotReject(() =>
      ensureTaskSourceWorkspace(sourceWorkspacesRoot, {
        uuid: 'workspace-1',
        name: 'Workspace 1',
        auth: {
          type: 'none'
        },
        repositories: [
          {
            uuid: 'repo-1',
            url: 'git@github.com:BangWork/plugin-runtime-manager.git'
          }
        ]
      })
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('ensureTaskSourceWorkspace prepares askpass env for HTTPS auth', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'agent-client-source-'));
  const sourceWorkspacesRoot = path.join(tempRoot, 'source-workspaces');

  try {
    const workspace = await ensureTaskSourceWorkspace(sourceWorkspacesRoot, {
      uuid: 'workspace-https',
      name: 'Workspace HTTPS',
      auth: {
        type: 'https',
        username: 'git-bot',
        secret: 'token-123'
      },
      repositories: []
    });

    assert.ok(workspace);
    assert.equal(workspace?.gitEnv.WORKSPACE_GIT_USERNAME, 'git-bot');
    assert.equal(workspace?.gitEnv.WORKSPACE_GIT_SECRET, 'token-123');
    assert.equal(workspace?.gitEnv.GIT_TERMINAL_PROMPT, '0');
    assert.match(workspace?.gitEnv.GIT_ASKPASS ?? '', /\.git-askpass\.sh$/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function execGit(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1'
    }
  });

  return result.stdout;
}
