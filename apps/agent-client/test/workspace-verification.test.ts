import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import {
  applyWorkspacePatchBundle,
  createWorkspacePatchBundle,
  runWorkspaceVerificationProfiles
} from '../src/task-run/workspace-verification.ts';

function git(cwd: string, args: string[]) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

async function createRepository(root: string, name: string) {
  const repositoryPath = path.join(root, name);
  execFileSync('mkdir', ['-p', repositoryPath]);
  git(repositoryPath, ['init']);
  git(repositoryPath, ['config', 'user.email', 'test@example.com']);
  git(repositoryPath, ['config', 'user.name', 'Test']);
  await writeFile(path.join(repositoryPath, 'tracked.txt'), 'base\n', 'utf8');
  git(repositoryPath, ['add', '.']);
  git(repositoryPath, ['commit', '-m', 'base']);
  return repositoryPath;
}

test('workspace patch includes tracked and untracked changes and can be replayed', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'workspace-patch-'));
  const source = await createRepository(root, 'source');
  const target = await createRepository(root, 'target');
  await writeFile(path.join(source, 'tracked.txt'), 'changed\n', 'utf8');
  await writeFile(path.join(source, 'new.txt'), 'new\n', 'utf8');

  const generated = await createWorkspacePatchBundle({
    taskUUID: 'task-1',
    repositories: [
      { uuid: 'repo-1', name: 'repo', worktreePath: source }
    ],
    gitEnv: {}
  });
  assert.equal(generated.bundle.repositories[0]?.changedFiles, 2);
  const sha256 = createHash('sha256')
    .update(Buffer.from(generated.bytes))
    .digest('hex');

  await applyWorkspacePatchBundle({
    bytes: generated.bytes,
    expectedSha256: sha256,
    repositories: [
      { uuid: 'repo-1', name: 'repo', worktreePath: target }
    ],
    gitEnv: {}
  });

  assert.equal(await readFile(path.join(target, 'tracked.txt'), 'utf8'), 'changed\n');
  assert.equal(await readFile(path.join(target, 'new.txt'), 'utf8'), 'new\n');
});

test('verification runs without a shell and skips later steps after failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'workspace-verify-'));
  const repository = await createRepository(root, 'repo');
  const results = await runWorkspaceVerificationProfiles({
    profiles: [
      {
        uuid: 'profile-1',
        workspaceUUID: 'workspace-1',
        workspaceName: 'Workspace',
        name: 'Checks',
        createdBy: 'user-1',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        steps: [
          {
            uuid: 'step-1',
            name: 'Fail',
            repositoryUUID: 'repo-1',
            workingDirectory: '',
            executable: process.execPath,
            args: ['-e', 'process.stderr.write("failed"); process.exit(2)'],
            timeoutSeconds: 10
          },
          {
            uuid: 'step-2',
            name: 'Skipped',
            repositoryUUID: 'repo-1',
            workingDirectory: '',
            executable: process.execPath,
            args: ['-e', 'process.exit(0)'],
            timeoutSeconds: 10
          }
        ]
      }
    ],
    repositories: [
      { uuid: 'repo-1', name: 'repo', worktreePath: repository }
    ],
    env: {},
    onLog: () => undefined
  });

  assert.equal(results[0]?.status, 'failed');
  assert.equal(results[0]?.steps[0]?.status, 'failed');
  assert.match(results[0]?.steps[0]?.stderr ?? '', /failed/u);
  assert.equal(results[0]?.steps[1]?.status, 'skipped');
});
