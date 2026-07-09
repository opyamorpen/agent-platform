import { existsSync } from 'node:fs';
import * as path from 'node:path';

const rootMarkers = ['pnpm-workspace.yaml', 'opkx.json'];

function findWorkspaceRootByMarkers(startDir: string): string | null {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (rootMarkers.some((marker) => existsSync(path.join(currentDir, marker)))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function findWorkspaceRootByModules(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  let matchedRoot: string | null = null;

  while (true) {
    if (existsSync(path.join(currentDir, 'dist', 'modules'))) {
      matchedRoot = currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return matchedRoot;
    }

    currentDir = parentDir;
  }
}

function resolveRuntimeRoot(): string {
  const entryDir = process.argv[1] ? path.dirname(process.argv[1]) : null;
  const startDirs = [process.cwd(), entryDir]
    .filter((value): value is string => Boolean(value))
    .map((value) => path.resolve(value));

  const markerRoot = startDirs
    .map((value) => findWorkspaceRootByMarkers(value))
    .find((value): value is string => Boolean(value));

  if (markerRoot) {
    return markerRoot;
  }

  const modulesRoot = startDirs
    .map((value) => findWorkspaceRootByModules(value))
    .find((value): value is string => Boolean(value));

  return modulesRoot ?? path.resolve(process.cwd());
}

export function resolveWorkspacePath(...segments: string[]): string {
  return path.resolve(resolveRuntimeRoot(), ...segments);
}
