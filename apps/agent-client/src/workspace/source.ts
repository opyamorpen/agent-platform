import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AgentClientTask,
  AgentClientTaskSourceWorkspaceAuth,
  AgentClientTaskSourceRepository
} from '@ones-ai-workflow/shared';
import { runGitCommand } from '../git-utils.js';
import { logger } from '../logger.js';

export interface PreparedSourceRepository {
  uuid: string;
  url: string;
  name: string;
  sourcePath: string;
}

export interface PreparedSourceWorkspace {
  uuid: string;
  name: string;
  workspaceRoot: string;
  repositoriesRoot: string;
  gitEnv: NodeJS.ProcessEnv;
  repositories: PreparedSourceRepository[];
}

export async function ensureTaskSourceWorkspace(
  sourceWorkspacesRoot: string,
  sourceWorkspace: AgentClientTask['sourceWorkspace']
): Promise<PreparedSourceWorkspace | null> {
  await mkdir(sourceWorkspacesRoot, { recursive: true });

  if (!sourceWorkspace) {
    return null;
  }

  const workspaceRoot = path.join(
    sourceWorkspacesRoot,
    normalizeWorkspaceDirectoryName(sourceWorkspace.uuid)
  );
  const repositoriesRoot = path.join(workspaceRoot, 'repos');
  const gitEnv = await ensureWorkspaceGitConfiguration(
    workspaceRoot,
    sourceWorkspace.auth
  );
  await mkdir(repositoriesRoot, { recursive: true });

  const preparedRepositories: PreparedSourceRepository[] = [];
  const seenRepositoryDirectoryNames = new Set<string>();

  for (const repository of sourceWorkspace.repositories) {
    const preparedRepository = toPreparedSourceRepository(
      repositoriesRoot,
      repository
    );

    const repositoryDirectoryName = path.basename(preparedRepository.sourcePath);

    if (seenRepositoryDirectoryNames.has(repositoryDirectoryName)) {
      logger.warn('Skipping duplicate source workspace repository name', {
        workspaceName: sourceWorkspace.name,
        repositoryUUID: repository.uuid,
        repositoryUrl: sanitizeRepositoryUrlForLogging(repository.url),
        repositoryName: preparedRepository.name,
        repositoryDirectoryName
      });
      continue;
    }

    seenRepositoryDirectoryNames.add(repositoryDirectoryName);
    await ensureRepositoryReady(preparedRepository, sourceWorkspace.name, gitEnv);
    preparedRepositories.push(preparedRepository);
  }

  preparedRepositories.sort((left, right) => left.name.localeCompare(right.name));

  return {
    uuid: sourceWorkspace.uuid,
    name: sourceWorkspace.name,
    workspaceRoot,
    repositoriesRoot,
    gitEnv,
    repositories: preparedRepositories
  };
}

function toPreparedSourceRepository(
  repositoriesRoot: string,
  repository: AgentClientTaskSourceRepository
): PreparedSourceRepository {
  const name = deriveRepositoryName(repository.url, repository.uuid);
  const sourcePath = path.join(repositoriesRoot, buildRepositoryDirectoryName(name));

  return {
    uuid: repository.uuid,
    url: repository.url,
    name,
    sourcePath
  };
}

async function ensureRepositoryReady(
  repository: PreparedSourceRepository,
  workspaceName: string,
  gitEnv: NodeJS.ProcessEnv
): Promise<void> {
  const existingStat = await safeStat(repository.sourcePath);

  if (!existingStat) {
    await cloneRepository(repository, workspaceName, gitEnv);
    return;
  }

  if (!existingStat.isDirectory()) {
    throw new Error(
      `Source workspace path is not a directory: ${repository.sourcePath}`
    );
  }

  if (!(await isGitRepository(repository.sourcePath, gitEnv))) {
    throw new Error(
      `Source workspace path exists but is not a git repository: ${repository.sourcePath}`
    );
  }

  const remoteUrl = await getRemoteOriginUrl(repository.sourcePath, gitEnv);

  if (remoteUrl && !areRepositoryUrlsEquivalent(remoteUrl, repository.url)) {
    throw new Error(
      `Source repository remote mismatch: ${repository.sourcePath} (${remoteUrl} != ${repository.url})`
    );
  }
}

async function cloneRepository(
  repository: PreparedSourceRepository,
  workspaceName: string,
  gitEnv: NodeJS.ProcessEnv
): Promise<void> {
  if (
    !gitEnv.GIT_SSH_COMMAND &&
    repositoryUrlRequiresWorkspaceSshKey(repository.url)
  ) {
    throw new Error(
      `Workspace SSH key is missing. Generate or rotate the workspace key for “${workspaceName}” first.`
    );
  }

  logger.info('Cloning missing source workspace repository', {
    workspaceName,
    repositoryUUID: repository.uuid,
    repositoryUrl: sanitizeRepositoryUrlForLogging(repository.url),
    sourcePath: repository.sourcePath
  });

  await runGitCommand(
    process.cwd(),
    [
      'clone',
      '--origin',
      'origin',
      repository.url,
      repository.sourcePath
    ],
    gitEnv
  );
}

async function isGitRepository(
  repoPath: string,
  gitEnv: NodeJS.ProcessEnv
): Promise<boolean> {
  try {
    await runGitCommand(repoPath, ['rev-parse', '--is-inside-work-tree'], gitEnv);
    return true;
  } catch {
    return false;
  }
}

async function getRemoteOriginUrl(
  repoPath: string,
  gitEnv: NodeJS.ProcessEnv
): Promise<string | null> {
  try {
    const result = await runGitCommand(
      repoPath,
      ['remote', 'get-url', 'origin'],
      gitEnv
    );
    return result.stdout.trim() || null;
  } catch {
    // Fall back to the raw configured value for older Git versions or missing remotes.
  }

  try {
    const result = await runGitCommand(
      repoPath,
      ['config', '--get', 'remote.origin.url'],
      gitEnv
    );
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function safeStat(targetPath: string) {
  try {
    return await stat(targetPath);
  } catch {
    return null;
  }
}

function deriveRepositoryName(url: string, uuid: string): string {
  const sanitizedUrl = url.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const lastSegment = sanitizedUrl.split('/').pop() ?? '';
  const trimmedGitSuffix = lastSegment.replace(/\.git$/i, '').trim();
  const normalizedName = trimmedGitSuffix
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizedName || `repo-${uuid.slice(0, 8).toLowerCase()}`;
}

function buildRepositoryDirectoryName(name: string): string {
  return name;
}

function areRepositoryUrlsEquivalent(left: string, right: string): boolean {
  return normalizeRepositoryUrlForComparison(left) === normalizeRepositoryUrlForComparison(right);
}

function normalizeRepositoryUrlForComparison(url: string): string {
  const trimmedUrl = url.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  const scpMatch = /^(?<user>[^@]+)@(?<host>[^:]+):(?<path>.+)$/u.exec(trimmedUrl);

  if (scpMatch?.groups) {
    return normalizeRepositoryLocator(
      scpMatch.groups.host,
      scpMatch.groups.path
    );
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.hostname && parsedUrl.pathname) {
      return normalizeRepositoryLocator(parsedUrl.hostname, parsedUrl.pathname);
    }
  } catch {
    // Keep the raw value when URL parsing fails.
  }

  return trimmedUrl;
}

function normalizeRepositoryLocator(host: string, pathname: string): string {
  const normalizedPath = pathname
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');

  return `${host.toLowerCase()}/${normalizedPath}`;
}

function repositoryUrlRequiresWorkspaceSshKey(url: string): boolean {
  return /^(git@|ssh:\/\/)/i.test(url.trim());
}

async function ensureWorkspaceGitConfiguration(
  workspaceRoot: string,
  auth: AgentClientTaskSourceWorkspaceAuth
): Promise<NodeJS.ProcessEnv> {
  await mkdir(workspaceRoot, { recursive: true });

  if (auth.type === 'ssh') {
    return ensureWorkspaceSshGitConfiguration(
      workspaceRoot,
      auth.publicKey,
      auth.privateKey
    );
  }

  if (auth.type === 'https') {
    return ensureWorkspaceHttpsGitConfiguration(
      workspaceRoot,
      auth.username,
      auth.secret
    );
  }

  return {};
}

async function ensureWorkspaceSshGitConfiguration(
  workspaceRoot: string,
  publicKey: string | null,
  privateKey: string | null
): Promise<NodeJS.ProcessEnv> {
  if (!privateKey?.trim()) {
    return {};
  }

  const sshRoot = path.join(workspaceRoot, '.ssh');
  const privateKeyPath = path.join(sshRoot, 'id_ed25519');
  const publicKeyPath = path.join(sshRoot, 'id_ed25519.pub');

  await mkdir(sshRoot, { recursive: true });
  await Promise.all([
    writeFile(privateKeyPath, ensureTrailingNewline(privateKey), {
      encoding: 'utf8',
      mode: 0o600
    }),
    writeFile(publicKeyPath, ensureTrailingNewline(publicKey ?? ''), {
      encoding: 'utf8',
      mode: 0o644
    })
  ]);
  await Promise.all([
    chmod(privateKeyPath, 0o600),
    chmod(publicKeyPath, 0o644)
  ]);

  return {
    GIT_SSH_COMMAND: buildGitSshCommand(privateKeyPath)
  };
}

async function ensureWorkspaceHttpsGitConfiguration(
  workspaceRoot: string,
  username: string,
  secret: string
): Promise<NodeJS.ProcessEnv> {
  const askPassPath = path.join(workspaceRoot, '.git-askpass.sh');

  await writeFile(
    askPassPath,
    [
      '#!/bin/sh',
      'case "$1" in',
      '  *Username*) printf \'%s\\n\' "$WORKSPACE_GIT_USERNAME" ;;',
      '  *Password*) printf \'%s\\n\' "$WORKSPACE_GIT_SECRET" ;;',
      '  *) printf \'\\n\' ;;',
      'esac'
    ].join('\n'),
    {
      encoding: 'utf8',
      mode: 0o700
    }
  );
  await chmod(askPassPath, 0o700);

  return {
    GIT_ASKPASS: askPassPath,
    GIT_TERMINAL_PROMPT: '0',
    WORKSPACE_GIT_USERNAME: username,
    WORKSPACE_GIT_SECRET: secret
  };
}

function buildGitSshCommand(privateKeyPath: string): string {
  return [
    'ssh',
    '-i',
    quoteShellArgument(privateKeyPath),
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'UserKnownHostsFile=/dev/null'
  ].join(' ');
}

function ensureTrailingNewline(value: string): string {
  const normalized = value.trimEnd();
  return normalized ? `${normalized}\n` : '';
}

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function sanitizeRepositoryUrlForLogging(url: string): string {
  const trimmedUrl = url.trim();

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (parsedUrl.username || parsedUrl.password) {
      parsedUrl.username = parsedUrl.username ? '***' : '';
      parsedUrl.password = parsedUrl.password ? '***' : '';
    }

    return parsedUrl.toString();
  } catch {
    return trimmedUrl;
  }
}

function normalizeWorkspaceDirectoryName(uuid: string): string {
  return uuid.trim().replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
}
