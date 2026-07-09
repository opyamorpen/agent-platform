import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { SkillManifest, SkillManifestItem } from '@ones-ai-workflow/shared';
import { downloadFileFromServer } from '../api.js';

export interface CachedSkillMeta extends SkillManifestItem {
  syncedAt: string;
  skillRootRelativePath: string;
}

export interface SkillCacheDependencies {
  downloadFileFromServer: typeof downloadFileFromServer;
  extractTarArchive: (
    archivePath: string,
    outputDirectory: string
  ) => Promise<void>;
  now: () => string;
}

export const defaultSkillCacheDependencies: SkillCacheDependencies = {
  downloadFileFromServer,
  extractTarArchive,
  now: () => new Date().toISOString()
};

export async function ensureSkillStorageDirectories(
  skillsRoot: string
): Promise<void> {
  await Promise.all([
    mkdir(skillsRoot, { recursive: true }),
    mkdir(getSkillsStoreRoot(skillsRoot), { recursive: true }),
    mkdir(getSkillsCurrentRoot(skillsRoot), { recursive: true })
  ]);
}

export async function readLocalSkillManifest(
  manifestPath: string
): Promise<SkillManifest | null> {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8')) as SkillManifest;
  } catch {
    return null;
  }
}

export async function writeLocalSkillManifest(
  manifestPath: string,
  manifest: SkillManifest
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

export function getRequiredSkillManifestItems(
  skillUUIDs: string[],
  manifest: SkillManifest
): SkillManifestItem[] {
  const requiredSkillUUIDs = dedupeSkillUUIDs(skillUUIDs);

  if (requiredSkillUUIDs.length === 0) {
    return [];
  }

  const manifestItemsByUUID = new Map(
    manifest.skills.map((skill) => [skill.uuid, skill] as const)
  );
  const requiredSkills: SkillManifestItem[] = [];

  for (const skillUUID of requiredSkillUUIDs) {
    const manifestItem = manifestItemsByUUID.get(skillUUID);

    if (!manifestItem) {
      throw new Error(`Required skill not found in manifest: ${skillUUID}`);
    }

    requiredSkills.push(manifestItem);
  }

  return requiredSkills;
}

export async function ensureRequiredSkillVersionsCached(options: {
  serverBaseUrl: string;
  accessToken: string;
  skillsRoot: string;
  skills: SkillManifestItem[];
  dependencies?: Partial<SkillCacheDependencies>;
}): Promise<void> {
  const dependencies = {
    ...defaultSkillCacheDependencies,
    ...options.dependencies
  };

  await ensureSkillStorageDirectories(options.skillsRoot);

  for (const skill of options.skills) {
    await ensureSkillVersionCached({
      serverBaseUrl: options.serverBaseUrl,
      accessToken: options.accessToken,
      skillsRoot: options.skillsRoot,
      skill,
      dependencies
    });
    await activateCurrentSkillVersion(options.skillsRoot, skill);
  }
}

export async function readCachedSkillMeta(
  cachedSkillRoot: string
): Promise<CachedSkillMeta> {
  const metaPath = path.join(cachedSkillRoot, 'meta.json');
  const cachedMeta = JSON.parse(
    await readFile(metaPath, 'utf8')
  ) as Partial<CachedSkillMeta>;

  return {
    uuid: requireStringField(cachedMeta.uuid, 'uuid', metaPath),
    name: requireStringField(cachedMeta.name, 'name', metaPath),
    description: requireStringField(
      cachedMeta.description,
      'description',
      metaPath
    ),
    version: requireNumberField(cachedMeta.version, 'version', metaPath),
    updatedAt: requireStringField(cachedMeta.updatedAt, 'updatedAt', metaPath),
    downloadPath: requireStringField(
      cachedMeta.downloadPath,
      'downloadPath',
      metaPath
    ),
    syncedAt: requireStringField(cachedMeta.syncedAt, 'syncedAt', metaPath),
    skillRootRelativePath: requireStringField(
      cachedMeta.skillRootRelativePath,
      'skillRootRelativePath',
      metaPath
    )
  };
}

export function resolveCachedSkillRootPath(
  cachedSkillRoot: string,
  cachedMeta: CachedSkillMeta
): string {
  return path.join(
    cachedSkillRoot,
    'files',
    cachedMeta.skillRootRelativePath === '.'
      ? ''
      : cachedMeta.skillRootRelativePath
  );
}

export function buildWorkspaceSkillDirectoryName(
  cachedMeta: Pick<CachedSkillMeta, 'name'>
): string {
  const safeName = cachedMeta.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safeName || 'skill';
}

export function getSkillsCurrentRoot(skillsRoot: string): string {
  return path.join(skillsRoot, 'current');
}

export function getSkillsManifestPath(skillsRoot: string): string {
  return path.join(skillsRoot, 'manifest.json');
}

async function ensureSkillVersionCached(options: {
  serverBaseUrl: string;
  accessToken: string;
  skillsRoot: string;
  skill: SkillManifestItem;
  dependencies: SkillCacheDependencies;
}): Promise<void> {
  const versionRoot = getSkillVersionRoot(
    options.skillsRoot,
    options.skill.uuid,
    options.skill.version
  );
  const filesRoot = path.join(versionRoot, 'files');
  const metaPath = path.join(versionRoot, 'meta.json');

  if ((await pathExists(filesRoot)) && (await pathExists(metaPath))) {
    return;
  }

  const storeSkillRoot = path.join(getSkillsStoreRoot(options.skillsRoot), options.skill.uuid);
  await mkdir(storeSkillRoot, { recursive: true });
  const tempVersionRoot = await mkdtemp(
    path.join(storeSkillRoot, `.tmp-v${options.skill.version}-`)
  );
  const archivePath = path.join(tempVersionRoot, 'skill.tar.gz');
  const extractedFilesRoot = path.join(tempVersionRoot, 'files');

  try {
    await mkdir(extractedFilesRoot, { recursive: true });
    await downloadSkillArchive(
      options.serverBaseUrl,
      options.accessToken,
      options.skill.downloadPath,
      archivePath,
      options.dependencies
    );
    await options.dependencies.extractTarArchive(archivePath, extractedFilesRoot);
    const skillRootRelativePath = await findSkillRootRelativePath(extractedFilesRoot);

    await writeFile(
      path.join(tempVersionRoot, 'meta.json'),
      JSON.stringify(
        {
          ...options.skill,
          syncedAt: options.dependencies.now(),
          skillRootRelativePath
        },
        null,
        2
      ),
      'utf8'
    );

    await rm(versionRoot, { recursive: true, force: true });
    await rename(tempVersionRoot, versionRoot);
  } catch (error) {
    await rm(tempVersionRoot, { recursive: true, force: true });
    throw error;
  }
}

async function activateCurrentSkillVersion(
  skillsRoot: string,
  skill: SkillManifestItem
): Promise<void> {
  const currentRoot = getSkillsCurrentRoot(skillsRoot);
  const currentSkillPath = path.join(currentRoot, skill.uuid);
  const versionRoot = getSkillVersionRoot(skillsRoot, skill.uuid, skill.version);

  await mkdir(currentRoot, { recursive: true });
  await rm(currentSkillPath, { recursive: true, force: true });
  await cp(versionRoot, currentSkillPath, { recursive: true });
}

function getSkillsStoreRoot(skillsRoot: string): string {
  return path.join(skillsRoot, 'store');
}

function getSkillVersionRoot(
  skillsRoot: string,
  skillUUID: string,
  version: number
): string {
  return path.join(getSkillsStoreRoot(skillsRoot), skillUUID, String(version));
}

async function findSkillRootRelativePath(
  extractedFilesRoot: string
): Promise<string> {
  const skillRoots = await collectSkillRootRelativePaths(extractedFilesRoot);

  if (skillRoots.length === 0) {
    throw new Error('Downloaded skill archive does not contain SKILL.md');
  }

  skillRoots.sort((left, right) => {
    const depthDiff = getPathDepth(left) - getPathDepth(right);
    return depthDiff !== 0 ? depthDiff : left.localeCompare(right);
  });

  return skillRoots[0] ?? '.';
}

async function collectSkillRootRelativePaths(
  directoryPath: string,
  relativePath = ''
): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const nextRelativePath = relativePath
      ? path.posix.join(relativePath, entry.name)
      : entry.name;
    const nextAbsolutePath = path.join(directoryPath, entry.name);

    if (entry.isFile() && entry.name === 'SKILL.md') {
      results.push(relativePath || '.');
      continue;
    }

    if (entry.isDirectory()) {
      results.push(
        ...(await collectSkillRootRelativePaths(nextAbsolutePath, nextRelativePath))
      );
    }
  }

  return results;
}

function getPathDepth(relativePath: string): number {
  if (relativePath === '.' || relativePath === '') {
    return 0;
  }

  return relativePath.split('/').length;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await readFile(targetPath);
    return true;
  } catch {
    try {
      await readdir(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}

async function downloadSkillArchive(
  serverBaseUrl: string,
  accessToken: string,
  downloadPath: string,
  outputPath: string,
  dependencies: SkillCacheDependencies
): Promise<void> {
  const response = await dependencies.downloadFileFromServer(
    serverBaseUrl,
    accessToken,
    downloadPath
  );

  if (!response.body) {
    throw new Error(`Skill download response body is empty: ${downloadPath}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as globalThis.ReadableStream),
    createWriteStream(outputPath)
  );
}

async function extractTarArchive(
  archivePath: string,
  outputDirectory: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archivePath, '-C', outputDirectory], {
      env: process.env
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`tar exited with code ${code}`));
    });
  });
}

function dedupeSkillUUIDs(skillUUIDs: string[]): string[] {
  return [...new Set(skillUUIDs.filter((skillUUID) => skillUUID.trim() !== ''))];
}

function requireStringField(
  value: string | undefined,
  fieldName: string,
  metaPath: string
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Cached skill meta missing ${fieldName}: ${metaPath}`);
  }

  return value;
}

function requireNumberField(
  value: number | undefined,
  fieldName: string,
  metaPath: string
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Cached skill meta missing ${fieldName}: ${metaPath}`);
  }

  return value;
}
