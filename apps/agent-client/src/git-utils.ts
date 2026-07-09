import { spawn } from 'node:child_process';

export async function runGitCommand(
  cwd: string,
  args: string[],
  extraEnv?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv
      }
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
        return;
      }

      reject(
        new Error(
          stderr.trim() || stdout.trim() || `git ${args.join(' ')} exited with code ${code}`
        )
      );
    });
  });
}
