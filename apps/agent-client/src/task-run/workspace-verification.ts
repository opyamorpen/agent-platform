import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type {
  AgentClientVerificationProfileResult,
  AgentClientVerificationStepResult,
  AgentClientWorkspacePatchBundle,
  WorkspaceVerificationProfile
} from '@ones-ai-workflow/shared';
import { runGitCommand } from '../git-utils.js';

const MAX_COMMAND_OUTPUT_CHARS = 64 * 1024;

export interface PreparedTaskRepository {
  uuid: string;
  name: string;
  worktreePath: string;
}

export async function applyWorkspacePatchBundle(input: {
  bytes: Uint8Array;
  expectedSha256: string;
  repositories: PreparedTaskRepository[];
  gitEnv: NodeJS.ProcessEnv;
}): Promise<void> {
  const actualSha256 = createHash('sha256')
    .update(Buffer.from(input.bytes))
    .digest('hex');
  if (actualSha256 !== input.expectedSha256) {
    throw new Error(
      `Previous workspace patch checksum mismatch: ${actualSha256}`
    );
  }
  const bundle = JSON.parse(
    Buffer.from(input.bytes).toString('utf8')
  ) as AgentClientWorkspacePatchBundle;
  if (bundle.version !== 1 || !Array.isArray(bundle.repositories)) {
    throw new Error('Previous workspace patch bundle is invalid');
  }
  const repositoryByUUID = new Map(
    input.repositories.map((repository) => [repository.uuid, repository] as const)
  );
  for (const patchRepository of bundle.repositories) {
    const repository = repositoryByUUID.get(patchRepository.repositoryUUID);
    if (!repository) {
      throw new Error(
        `Previous workspace patch repository is unavailable: ${patchRepository.repositoryUUID}`
      );
    }
    if (!patchRepository.patch) {
      continue;
    }
    await runGitCommand(
      repository.worktreePath,
      ['apply', '--binary', '--whitespace=nowarn', '-'],
      input.gitEnv,
      patchRepository.patch
    );
  }
}

export async function runWorkspaceVerificationProfiles(input: {
  profiles: WorkspaceVerificationProfile[];
  repositories: PreparedTaskRepository[];
  env: NodeJS.ProcessEnv;
  onLog: (message: string) => void;
}): Promise<AgentClientVerificationProfileResult[]> {
  const repositoryByUUID = new Map(
    input.repositories.map((repository) => [repository.uuid, repository] as const)
  );
  const results: AgentClientVerificationProfileResult[] = [];

  for (const profile of input.profiles) {
    const stepResults: AgentClientVerificationStepResult[] = [];
    let profileFailed = false;
    for (const step of profile.steps) {
      if (profileFailed) {
        const now = new Date().toISOString();
        stepResults.push({
          stepUUID: step.uuid,
          stepName: step.name,
          repositoryUUID: step.repositoryUUID,
          command: formatCommand(step.executable, step.args),
          status: 'skipped',
          exitCode: null,
          stdout: '',
          stderr: 'Skipped because a previous verification step failed',
          startedAt: now,
          finishedAt: now,
          durationMs: 0
        });
        continue;
      }
      const repository = repositoryByUUID.get(step.repositoryUUID);
      if (!repository) {
        const now = new Date().toISOString();
        stepResults.push({
          stepUUID: step.uuid,
          stepName: step.name,
          repositoryUUID: step.repositoryUUID,
          command: formatCommand(step.executable, step.args),
          status: 'failed',
          exitCode: null,
          stdout: '',
          stderr: `Repository is unavailable: ${step.repositoryUUID}`,
          startedAt: now,
          finishedAt: now,
          durationMs: 0
        });
        profileFailed = true;
        continue;
      }
      const cwd = resolveWorkingDirectory(
        repository.worktreePath,
        step.workingDirectory
      );
      input.onLog(
        `[verification] ${profile.name} / ${step.name}: ${formatCommand(step.executable, step.args)}`
      );
      const result = await runCommand({
        executable: step.executable,
        args: step.args,
        cwd,
        env: input.env,
        timeoutMs: step.timeoutSeconds * 1_000
      });
      stepResults.push({
        stepUUID: step.uuid,
        stepName: step.name,
        repositoryUUID: step.repositoryUUID,
        command: formatCommand(step.executable, step.args),
        ...result
      });
      if (result.status !== 'passed') {
        profileFailed = true;
      }
    }
    results.push({
      profileUUID: profile.uuid,
      profileName: profile.name,
      status: profileFailed ? 'failed' : 'passed',
      steps: stepResults
    });
  }
  return results;
}

export async function createWorkspacePatchBundle(input: {
  taskUUID: string;
  repositories: PreparedTaskRepository[];
  gitEnv: NodeJS.ProcessEnv;
}): Promise<{ bundle: AgentClientWorkspacePatchBundle; bytes: Uint8Array }> {
  const patchRepositories: AgentClientWorkspacePatchBundle['repositories'] = [];
  for (const repository of input.repositories) {
    await runGitCommand(
      repository.worktreePath,
      ['add', '-N', '--', '.'],
      input.gitEnv
    ).catch(() => undefined);
    const [patchResult, numstatResult] = await Promise.all([
      runGitCommand(
        repository.worktreePath,
        ['diff', '--binary', '--no-ext-diff', '--'],
        input.gitEnv
      ),
      runGitCommand(
        repository.worktreePath,
        ['diff', '--numstat', '--no-ext-diff', '--'],
        input.gitEnv
      )
    ]);
    if (!patchResult.stdout) {
      continue;
    }
    const stats = parseNumstat(numstatResult.stdout);
    patchRepositories.push({
      repositoryUUID: repository.uuid,
      repositoryName: repository.name,
      changedFiles: stats.changedFiles,
      additions: stats.additions,
      deletions: stats.deletions,
      patch: `${patchResult.stdout}\n`
    });
  }
  const bundle: AgentClientWorkspacePatchBundle = {
    version: 1,
    sourceTaskUUID: input.taskUUID,
    repositories: patchRepositories
  };
  return {
    bundle,
    bytes: new Uint8Array(Buffer.from(JSON.stringify(bundle), 'utf8'))
  };
}

function resolveWorkingDirectory(repositoryRoot: string, relativePath: string): string {
  const resolved = path.resolve(repositoryRoot, relativePath || '.');
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Verification working directory is outside repository: ${relativePath}`);
  }
  return resolved;
}

function formatCommand(executable: string, args: string[]): string {
  return [executable, ...args.map((arg) => JSON.stringify(arg))].join(' ');
}

function parseNumstat(value: string): {
  changedFiles: number;
  additions: number;
  deletions: number;
} {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    const [added, deleted] = line.split('\t');
    additions += added === '-' ? 0 : Number.parseInt(added ?? '0', 10) || 0;
    deletions += deleted === '-' ? 0 : Number.parseInt(deleted ?? '0', 10) || 0;
  }
  return { changedFiles: lines.length, additions, deletions };
}

async function runCommand(input: {
  executable: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}): Promise<Omit<AgentClientVerificationStepResult, 'stepUUID' | 'stepName' | 'repositoryUUID' | 'command'>> {
  const started = new Date();
  const startedAt = started.toISOString();
  return new Promise((resolve) => {
    const child = spawn(input.executable, input.args, {
      cwd: input.cwd,
      env: { ...process.env, ...input.env },
      shell: false
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: unknown) =>
      `${current}${String(chunk)}`.slice(-MAX_COMMAND_OUTPUT_CHARS);
    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk);
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
    }, input.timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timeout);
      const finished = new Date();
      resolve({
        status: 'failed',
        exitCode: null,
        stdout,
        stderr: append(stderr, error.message),
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - started.getTime()
      });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const finished = new Date();
      resolve({
        status: timedOut ? 'timed_out' : code === 0 ? 'passed' : 'failed',
        exitCode: code,
        stdout,
        stderr,
        startedAt,
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - started.getTime()
      });
    });
  });
}
