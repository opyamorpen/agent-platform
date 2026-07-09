import { mkdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { runGitCommand } from '../git-utils.js';
import type { PreparedSourceWorkspace } from './source.js';

export interface PreparedWorkspaceRepo {
  name: string;
  sourcePath: string;
  worktreePath: string;
}

export interface PreparedWorkspace {
  workspaceRoot: string;
  gitEnv: NodeJS.ProcessEnv;
  repos: PreparedWorkspaceRepo[];
  cleanup: () => Promise<void>;
}

type GitCommandRunner = typeof runGitCommand;
const MISSING_REGISTERED_WORKTREE_MESSAGE =
  'is a missing but already registered worktree';

export async function prepareWorkspace(
  taskRoot: string,
  sourceWorkspace: PreparedSourceWorkspace | null
): Promise<PreparedWorkspace> {
  const workspaceRoot = path.join(taskRoot, 'workspace');

  await rm(workspaceRoot, { recursive: true, force: true });
  await mkdir(workspaceRoot, { recursive: true });

  const preparedRepos: PreparedWorkspaceRepo[] = [];

  try {
    for (const repo of sourceWorkspace?.repositories ?? []) {
      const worktreePath = path.join(workspaceRoot, repo.name);
      await addDetachedWorktree(repo.sourcePath, worktreePath);
      preparedRepos.push({
        name: repo.name,
        sourcePath: repo.sourcePath,
        worktreePath
      });
    }

    await writeWorkspaceMetadata(
      workspaceRoot,
      preparedRepos,
      sourceWorkspace
    );
  } catch (error) {
    await cleanupWorkspace(workspaceRoot, preparedRepos);
    throw error;
  }

  return {
    workspaceRoot,
    gitEnv: sourceWorkspace?.gitEnv ?? {},
    repos: preparedRepos,
    cleanup: async () => {
      await cleanupWorkspace(workspaceRoot, preparedRepos);
    }
  };
}

export function isMissingRegisteredWorktreeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return message.includes(MISSING_REGISTERED_WORKTREE_MESSAGE);
}

export async function pruneGitWorktrees(
  sourcePath: string,
  gitCommandRunner: GitCommandRunner = runGitCommand
): Promise<void> {
  await gitCommandRunner(sourcePath, ['worktree', 'prune']);
}

export async function addDetachedWorktree(
  sourcePath: string,
  worktreePath: string,
  gitCommandRunner: GitCommandRunner = runGitCommand
): Promise<void> {
  await pruneGitWorktrees(sourcePath, gitCommandRunner);

  try {
    await gitCommandRunner(sourcePath, [
      'worktree',
      'add',
      '--detach',
      worktreePath,
      'HEAD'
    ]);
  } catch (error) {
    if (!isMissingRegisteredWorktreeError(error)) {
      throw error;
    }

    await pruneGitWorktrees(sourcePath, gitCommandRunner);
    await gitCommandRunner(sourcePath, [
      'worktree',
      'add',
      '--detach',
      worktreePath,
      'HEAD'
    ]);
  }
}

async function writeWorkspaceMetadata(
  workspaceRoot: string,
  repos: PreparedWorkspaceRepo[],
  sourceWorkspace: PreparedSourceWorkspace | null
): Promise<void> {
  const repoIndex = repos.map((repo) => ({
    name: repo.name,
    sourcePath: repo.sourcePath,
    worktreePath: repo.worktreePath
  }));
  const workspaceGuide = [
    '# Workspace',
    '',
    sourceWorkspace
      ? `This task workspace contains detached git worktrees created from the prepared source workspace "${sourceWorkspace.name}" (${sourceWorkspace.uuid}).`
      : 'This task workspace does not use a source workspace.',
    '',
    ...(sourceWorkspace
      ? [
          'Source workspace:',
          `- ${sourceWorkspace.name} (${sourceWorkspace.uuid})`,
          ''
        ]
      : []),
    'Repositories:',
    ...(repos.length > 0
      ? repos.map((repo) => `- ${repo.name}: ./${repo.name}`)
      : ['- None'])
  ].join('\n');
  const workspaceGuideWithSkills = `${workspaceGuide}\n\nSkills:\n- Codex skills: ./.agents/skills\n- Claude skills: ./.claude/skills\n- skills manifest: ./.agents/skills-manifest.json`;

  await Promise.all([
    writeFile(path.join(workspaceRoot, 'WORKSPACE.md'), workspaceGuideWithSkills, 'utf8'),
    writeFile(
      path.join(workspaceRoot, 'repos.json'),
      JSON.stringify(repoIndex, null, 2),
      'utf8'
    )
  ]);
}

async function cleanupWorkspace(
  workspaceRoot: string,
  repos: PreparedWorkspaceRepo[]
): Promise<void> {
  const errors: string[] = [];
  const repoSourcesNeedingPrune = new Set<string>();

  for (const repo of [...repos].reverse()) {
    try {
      await runGitCommand(repo.sourcePath, [
        'worktree',
        'remove',
        '--force',
        repo.worktreePath
      ]);
    } catch (error) {
      errors.push(
        `remove ${repo.worktreePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    repoSourcesNeedingPrune.add(repo.sourcePath);
  }

  await rm(workspaceRoot, { recursive: true, force: true });

  for (const sourcePath of repoSourcesNeedingPrune) {
    try {
      await runGitCommand(sourcePath, ['worktree', 'prune']);
    } catch (error) {
      errors.push(
        `prune ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Workspace cleanup failed\n${errors.join('\n')}`);
  }
}
