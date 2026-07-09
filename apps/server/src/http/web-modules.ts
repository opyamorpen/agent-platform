import type { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { failure } from '../lib/api-response.js';
import { env } from '../config/env.js';
import { getLogger } from '../lib/logger.js';
import { resolveWorkspacePath } from '../lib/runtime-path.js';

const logger = getLogger('web-modules');
const modulesRoots = [
  env.ONES_HOSTED_MODULES_ROOT,
  resolveWorkspacePath('dist', 'modules'),
  resolveWorkspacePath('apps', 'web', 'dist')
]
  .filter((value): value is string => Boolean(value))
  .map((value) => path.resolve(value))
  .filter((value, index, values) => values.indexOf(value) === index);

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function resolveModulesFilePaths(requestPath: string): string[] {
  const modulesPathMatch = requestPath.match(/\/modules(?:\/(.*))?$/);

  if (!modulesPathMatch) {
    return [];
  }

  const relativePath = modulesPathMatch[1] ?? '';
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidatePaths: string[] = [];

  for (const modulesRoot of modulesRoots) {
    const resolvedPath = path.resolve(modulesRoot, normalizedPath);

    if (resolvedPath.startsWith(modulesRoot)) {
      candidatePaths.push(resolvedPath);
    }

    if (modulesRoot.endsWith(path.join('apps', 'web', 'dist'))) {
      const appSettingsPrefix = `app-settings${path.sep}`;

      if (normalizedPath === 'app-settings') {
        candidatePaths.push(modulesRoot);
      } else if (normalizedPath.startsWith(appSettingsPrefix)) {
        candidatePaths.push(path.resolve(modulesRoot, normalizedPath.slice(appSettingsPrefix.length)));
      }
    }
  }

  return candidatePaths.filter((value, index, values) => values.indexOf(value) === index);
}

export function registerWebModulesFallback(app: Hono): void {
  logger.info('[web-modules] initialized static modules mapping', {
    cwd: process.cwd(),
    entryFile: process.argv[1] ?? null,
    configuredModulesRoot: env.ONES_HOSTED_MODULES_ROOT ?? null,
    resolvedModulesRoots: modulesRoots,
    modulesRootExists: modulesRoots.map((modulesRoot) => ({
      modulesRoot,
      exists: existsSync(modulesRoot)
    }))
  });

  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET') {
      return next();
    }

    const requestPath = new URL(c.req.url).pathname;
    const resolvedPaths = resolveModulesFilePaths(requestPath);

    if (resolvedPaths.length === 0) {
      return next();
    }

    logger.debug('[web-modules] resolving request', {
      requestPath,
      resolvedPaths,
      modulesRoots
    });

    const candidatePaths: string[] = [];

    for (const resolvedPath of resolvedPaths) {
      candidatePaths.push(resolvedPath);

      if (!path.extname(resolvedPath)) {
        candidatePaths.push(path.join(resolvedPath, 'index.html'));
      }
    }

    for (const candidatePath of candidatePaths) {
      try {
        const content = await readFile(candidatePath);

        return c.body(content, 200, {
          'content-type': getContentType(candidatePath)
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    logger.warn('[web-modules] static module route not found', {
      requestPath,
      resolvedPaths,
      candidatePaths,
      candidatePathExists: candidatePaths.map((candidatePath) => ({
        candidatePath,
        exists: existsSync(candidatePath)
      })),
      modulesRoots
    });

    return c.json(failure('Route not found', 'common.route_not_found'), 404);
  });
}
