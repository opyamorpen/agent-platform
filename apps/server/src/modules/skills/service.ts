import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Readable } from 'node:stream';
import type {
  SkillManifest,
  SkillManifestItem,
  SkillSummary
} from '@ones-ai-workflow/shared';
import { findAgentsBySkillUUID } from '../agents/repository.js';
import {
  buildHostedObjectKey,
  deleteObject,
  getObjectDownloadUrl,
  openObjectStream,
  uploadObjectBuffer
} from '../../lib/hosted-storage.js';
import {
  createSkill,
  createSkillVersion,
  deleteSkillByUUID,
  deleteSkillVersionBySkillUUID,
  findSkillByUUIDAcrossTeams,
  findSkillByName,
  findSkillByUUID,
  findSkillVersion,
  findSkillVersionAcrossTeams,
  listAllSkills,
  listSkills,
  listSkillVersionsBySkillUUID,
  type SkillRecord,
  updateSkill
} from './repository.js';

export interface UploadedSkillFile {
  relativePath: string;
  file: File;
}

export interface SkillDownloadPackage {
  fileName: string;
  stream: Readable;
}

export interface SkillDownloadUrlPackage {
  fileName: string;
  downloadUrl: string;
}

export class SkillNotFoundError extends Error {
  constructor(uuid: string) {
    super(`Skill not found: ${uuid}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillConflictError extends Error {
  constructor(name: string) {
    super(`Skill name already exists: ${name}`);
    this.name = 'SkillConflictError';
  }
}

export class InvalidSkillPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSkillPackageError';
  }
}

export class SkillInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillInUseError';
  }
}

export async function getSkillSummaries(teamUUID: string): Promise<SkillSummary[]> {
  const skills = await listSkills(teamUUID);
  return skills.map(toSkillSummary);
}

export async function getSkillManifest(teamUUID?: string): Promise<SkillManifest> {
  const skills = teamUUID ? await listSkills(teamUUID) : await listAllSkills();
  const manifestItems = skills
    .map((skill: SkillRecord) => toSkillManifestItem(skill))
    .sort((left: SkillManifestItem, right: SkillManifestItem) =>
      left.uuid.localeCompare(right.uuid)
    );

  return {
    revision: buildManifestRevision(manifestItems),
    skills: manifestItems
  };
}

export async function createSkillRecord(payload: {
  files: UploadedSkillFile[];
}, teamUUID: string): Promise<SkillSummary> {
  const files = sanitizeUploadedFiles(payload.files);
  const metadata = await extractSkillMetadata(files);
  const name = metadata.name;
  const description = metadata.description;
  const existingSkill = await findSkillByName(name, teamUUID);

  if (existingSkill) {
    throw new SkillConflictError(name);
  }

  const skillUUID = randomUUID();
  const version = 1;
  const storagePath = getVersionStoragePath(skillUUID, version);
  const archive = await createSkillArchive(files, buildArchiveBaseName(name, version));

  try {
    await uploadObjectBuffer(
      storagePath,
      await readFile(archive.archivePath),
      'application/gzip'
    );

    const createdSkill = await createSkill({
      teamUUID,
      uuid: skillUUID,
      name,
      description,
      currentVersion: version
    });

    try {
      await createSkillVersion({
        teamUUID,
        uuid: randomUUID(),
        skillUUID,
        version,
        storagePath,
        fileCount: files.length
      });
    } catch (error) {
      await deleteSkillByUUID(skillUUID, teamUUID).catch(() => undefined);
      throw error;
    }

    return toSkillSummary(createdSkill);
  } catch (error) {
    await deleteObject(storagePath).catch(() => undefined);

    throw error;
  } finally {
    await archive.cleanup();
  }
}

export async function uploadSkillVersionRecord(
  uuid: string,
  payload: { files: UploadedSkillFile[] },
  teamUUID: string
): Promise<SkillSummary> {
  const skill = await findSkillByUUID(uuid, teamUUID);

  if (!skill) {
    throw new SkillNotFoundError(uuid);
  }

  const files = sanitizeUploadedFiles(payload.files);
  const metadata = await extractSkillMetadata(files);
  const conflictingSkill = await findSkillByName(metadata.name, teamUUID);

  if (conflictingSkill && conflictingSkill.uuid !== uuid) {
    throw new SkillConflictError(metadata.name);
  }

  const nextVersion = skill.currentVersion + 1;
  const storagePath = getVersionStoragePath(uuid, nextVersion);
  const archive = await createSkillArchive(
    files,
    buildArchiveBaseName(metadata.name, nextVersion)
  );

  try {
    await uploadObjectBuffer(
      storagePath,
      await readFile(archive.archivePath),
      'application/gzip'
    );

    await createSkillVersion({
      teamUUID,
      uuid: randomUUID(),
      skillUUID: uuid,
      version: nextVersion,
      storagePath,
      fileCount: files.length
    });

    const updatedSkill = await updateSkill(
      uuid,
      {
        name: metadata.name,
        description: metadata.description,
        currentVersion: nextVersion
      },
      teamUUID
    );

    if (!updatedSkill) {
      throw new SkillNotFoundError(uuid);
    }

    return toSkillSummary(updatedSkill);
  } catch (error) {
    await deleteObject(storagePath).catch(() => undefined);

    throw error;
  } finally {
    await archive.cleanup();
  }
}

export async function createSkillDownloadPackage(
  uuid: string,
  version?: number,
  teamUUID?: string
): Promise<SkillDownloadPackage> {
  const skill = teamUUID
    ? await findSkillByUUID(uuid, teamUUID)
    : await findSkillByUUIDAcrossTeams(uuid);

  if (!skill) {
    throw new SkillNotFoundError(uuid);
  }

  const resolvedVersion = version ?? skill.currentVersion;
  const skillVersion = teamUUID
    ? await findSkillVersion(uuid, resolvedVersion, teamUUID)
    : await findSkillVersionAcrossTeams(uuid, resolvedVersion);

  if (!skillVersion) {
    throw new SkillNotFoundError(uuid);
  }

  const opened = await openObjectStream(skillVersion.storagePath);

  if (!opened) {
    throw new SkillNotFoundError(uuid);
  }

  return {
    fileName: `${buildArchiveBaseName(skill.name, resolvedVersion)}.tar.gz`,
    stream: opened.stream as Readable
  };
}

export async function createSkillDownloadUrlPackage(
  uuid: string,
  version?: number,
  teamUUID?: string
): Promise<SkillDownloadUrlPackage> {
  const skill = teamUUID
    ? await findSkillByUUID(uuid, teamUUID)
    : await findSkillByUUIDAcrossTeams(uuid);

  if (!skill) {
    throw new SkillNotFoundError(uuid);
  }

  const resolvedVersion = version ?? skill.currentVersion;
  const skillVersion = teamUUID
    ? await findSkillVersion(uuid, resolvedVersion, teamUUID)
    : await findSkillVersionAcrossTeams(uuid, resolvedVersion);

  if (!skillVersion) {
    throw new SkillNotFoundError(uuid);
  }

  const downloadUrl = await getObjectDownloadUrl(skillVersion.storagePath);

  if (!downloadUrl) {
    throw new SkillNotFoundError(uuid);
  }

  return {
    fileName: `${buildArchiveBaseName(skill.name, resolvedVersion)}.tar.gz`,
    downloadUrl
  };
}

export async function removeSkillRecord(
  uuid: string,
  teamUUID: string
): Promise<void> {
  const skill = await findSkillByUUID(uuid, teamUUID);

  if (!skill) {
    throw new SkillNotFoundError(uuid);
  }

  const referencingAgents = await findAgentsBySkillUUID(uuid, teamUUID);

  if (referencingAgents.length > 0) {
    throw new SkillInUseError(
      `Skill is referenced by agent ${referencingAgents[0]?.name ?? referencingAgents[0]?.uuid}`
    );
  }

  const skillVersions = await listSkillVersionsBySkillUUID(uuid, teamUUID);
  await deleteSkillVersionBySkillUUID(uuid, teamUUID);
  await deleteSkillByUUID(uuid, teamUUID);

  await Promise.all(
    skillVersions.map((skillVersion: { storagePath: string }) =>
      deleteObject(skillVersion.storagePath).catch(() => undefined)
    )
  );
}

function toSkillSummary(skill: SkillRecord): SkillSummary {
  return {
    uuid: skill.uuid,
    name: skill.name,
    description: skill.description,
    currentVersion: skill.currentVersion,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString()
  };
}

function toSkillManifestItem(skill: SkillRecord): SkillManifestItem {
  return {
    uuid: skill.uuid,
    name: skill.name,
    description: skill.description,
    version: skill.currentVersion,
    updatedAt: skill.updatedAt.toISOString(),
    downloadPath: buildAgentClientSkillVersionDownloadPath(
      skill.uuid,
      skill.currentVersion
    )
  };
}

function buildManifestRevision(skills: SkillManifestItem[]): string {
  const hash = createHash('sha256');

  for (const skill of skills) {
    hash.update(
      `${skill.uuid}:${skill.version}:${skill.updatedAt}:${skill.name}:${skill.description}\n`
    );
  }

  return hash.digest('hex');
}

function sanitizeUploadedFiles(files: UploadedSkillFile[]): UploadedSkillFile[] {
  if (files.length === 0) {
    throw new InvalidSkillPackageError('Skill package must contain at least one file');
  }

  const seenPaths = new Set<string>();

  return files.map((entry) => {
    const relativePath = normalizeRelativePath(entry.relativePath);

    if (seenPaths.has(relativePath)) {
      throw new InvalidSkillPackageError(`Duplicated file path: ${relativePath}`);
    }

    seenPaths.add(relativePath);

    return {
      relativePath,
      file: entry.file
    };
  });
}

async function extractSkillMetadata(
  files: UploadedSkillFile[]
): Promise<{ name: string; description: string }> {
  const skillFile = findSkillMarkdownFile(files);

  if (!skillFile) {
    throw new InvalidSkillPackageError('Skill package must include SKILL.md');
  }

  const content = await skillFile.file.text();
  const frontmatterMatch = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
  );

  if (!frontmatterMatch) {
    throw new InvalidSkillPackageError(
      'SKILL.md must start with a frontmatter block containing name and description'
    );
  }

  const frontmatter = parseFrontmatter(frontmatterMatch[1] ?? '');
  const name = frontmatter.name?.trim();
  const description = frontmatter.description?.trim();

  if (!name) {
    throw new InvalidSkillPackageError('SKILL.md frontmatter must contain name');
  }

  if (!description) {
    throw new InvalidSkillPackageError(
      'SKILL.md frontmatter must contain description'
    );
  }

  return {
    name,
    description
  };
}

function findSkillMarkdownFile(files: UploadedSkillFile[]): UploadedSkillFile | null {
  const candidates = files
    .filter((entry) => path.posix.basename(entry.relativePath) === 'SKILL.md')
    .sort(
      (left, right) =>
        left.relativePath.split('/').length - right.relativePath.split('/').length
    );

  return candidates[0] ?? null;
}

function parseFrontmatter(value: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    result[key] = stripWrappingQuotes(rawValue);
  }

  return result;
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeRelativePath(value: string): string {
  const normalizedValue = value.replace(/\\/g, '/').trim();

  if (!normalizedValue) {
    throw new InvalidSkillPackageError('File path is required');
  }

  if (normalizedValue.startsWith('/')) {
    throw new InvalidSkillPackageError(`Absolute path is not allowed: ${value}`);
  }

  const segments = normalizedValue.split('/').filter(Boolean);

  if (segments.length === 0) {
    throw new InvalidSkillPackageError(`Invalid file path: ${value}`);
  }

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new InvalidSkillPackageError(`Unsafe file path: ${value}`);
    }
  }

  return segments.join('/');
}

async function writeSkillFiles(
  targetDirectory: string,
  files: UploadedSkillFile[]
): Promise<void> {
  await mkdir(targetDirectory, { recursive: true });

  for (const entry of files) {
    const outputPath = path.join(targetDirectory, ...entry.relativePath.split('/'));
    await mkdir(path.dirname(outputPath), { recursive: true });
    const fileBuffer = Buffer.from(await entry.file.arrayBuffer());
    await writeFile(outputPath, fileBuffer, {
      mode: hasShebang(fileBuffer) ? 0o755 : 0o644
    });
  }
}

function buildSkillVersionDownloadPath(skillUUID: string, version: number): string {
  return `/api/skills/${skillUUID}/versions/${version}/download`;
}

function buildAgentClientSkillVersionDownloadPath(
  skillUUID: string,
  version: number
): string {
  return `api/agent-clients/skills/${skillUUID}/versions/${version}/download`;
}

function buildArchiveBaseName(name: string, version: number): string {
  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeName || 'skill'}-v${version}`;
}

function getVersionStoragePath(skillUUID: string, version: number): string {
  return buildHostedObjectKey('skill', skillUUID, `version-${version}.tar.gz`);
}

async function createTarArchive(
  sourceDirectory: string,
  archivePath: string
): Promise<void> {
  await mkdir(path.dirname(archivePath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-czf', archivePath, '-C', sourceDirectory, '.'], {
      env: process.env
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `tar exited with code ${code ?? 'unknown'}`
          )
        );
        return;
      }

      resolve();
    });
  });
}

function hasShebang(fileBuffer: Buffer): boolean {
  return fileBuffer.length >= 2 && fileBuffer[0] === 35 && fileBuffer[1] === 33;
}

async function createSkillArchive(
  files: UploadedSkillFile[],
  archiveBaseName: string
): Promise<{
  archivePath: string;
  cleanup: () => Promise<void>;
}> {
  const workspaceDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'ones-ai-workflow-skill-')
  );
  const sourceDirectory = path.join(workspaceDirectory, 'files');
  const archivePath = path.join(workspaceDirectory, `${archiveBaseName}.tar.gz`);

  try {
    await writeSkillFiles(sourceDirectory, files);
    await createTarArchive(sourceDirectory, archivePath);
  } catch (error) {
    await rm(workspaceDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    archivePath,
    cleanup: () => rm(workspaceDirectory, { recursive: true, force: true })
  };
}
