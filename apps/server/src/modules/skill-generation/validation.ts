import type { SkillGenerationFile } from '@ones-ai-workflow/shared';
import * as path from 'node:path';

const MAX_FILES = 50;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_PATH_LENGTH = 240;
const BASE64_BLOCK = /(?:^|\s)[A-Za-z0-9+/]{4096,}={0,2}(?:\s|$)/m;
const DOWNLOAD_COMMAND =
  /(?:\b(?:curl|wget|invoke-webrequest)\s+(?:-[^\s]+\s+)*https?:\/\/|\b(?:requests\.(?:get|post)|urllib\.request\.[a-z_]+|fetch)\s*\(\s*['"]https?:\/\/)/i;
const SCRIPT_EXTENSIONS = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.py',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.rb',
  '.pl',
  '.php',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.kts',
  '.lua'
]);
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.csv',
  '.tsv',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.ini',
  '.cfg',
  '.conf',
  '.properties',
  ...SCRIPT_EXTENSIONS
]);
const TEXT_FILENAMES = new Set(['Dockerfile', 'Makefile', 'LICENSE']);

export class InvalidGeneratedSkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGeneratedSkillError';
  }
}

export function validateGeneratedSkillFiles(files: SkillGenerationFile[]): {
  files: SkillGenerationFile[];
  hasScripts: boolean;
} {
  if (files.length === 0 || files.length > MAX_FILES) {
    throw new InvalidGeneratedSkillError(
      `Skill must contain between 1 and ${MAX_FILES} files`
    );
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  let hasScripts = false;
  let rootSkillCount = 0;

  const normalizedFiles = files.map((file) => {
    const normalizedPath = normalizePath(file.path);

    if (seen.has(normalizedPath)) {
      throw new InvalidGeneratedSkillError(
        `Duplicated file path: ${normalizedPath}`
      );
    }
    seen.add(normalizedPath);

    const extension = path.posix.extname(normalizedPath).toLowerCase();
    const basename = path.posix.basename(normalizedPath);
    if (!TEXT_EXTENSIONS.has(extension) && !TEXT_FILENAMES.has(basename)) {
      throw new InvalidGeneratedSkillError(
        `Unsupported generated file type: ${normalizedPath}`
      );
    }

    if (file.content.includes('\0')) {
      throw new InvalidGeneratedSkillError(
        `Binary content is not allowed: ${normalizedPath}`
      );
    }
    if (
      /data:[^\s;,]+;base64,/i.test(file.content) ||
      BASE64_BLOCK.test(file.content)
    ) {
      throw new InvalidGeneratedSkillError(
        `Encoded binary content is not allowed: ${normalizedPath}`
      );
    }
    if (DOWNLOAD_COMMAND.test(file.content)) {
      throw new InvalidGeneratedSkillError(
        `External download commands are not allowed: ${normalizedPath}`
      );
    }

    const bytes = Buffer.byteLength(file.content, 'utf8');
    if (bytes > MAX_FILE_BYTES) {
      throw new InvalidGeneratedSkillError(
        `File exceeds 256 KB: ${normalizedPath}`
      );
    }
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new InvalidGeneratedSkillError(
        'Skill files exceed the 2 MB total limit'
      );
    }

    if (normalizedPath === 'SKILL.md') {
      rootSkillCount += 1;
      validateSkillMarkdown(file.content);
    }

    hasScripts ||=
      SCRIPT_EXTENSIONS.has(extension) || file.content.startsWith('#!');
    return { path: normalizedPath, content: file.content };
  });

  if (
    rootSkillCount !== 1 ||
    normalizedFiles.some(
      (file) =>
        file.path !== 'SKILL.md' &&
        path.posix.basename(file.path) === 'SKILL.md'
    )
  ) {
    throw new InvalidGeneratedSkillError(
      'Skill must contain exactly one root-level SKILL.md'
    );
  }

  return { files: normalizedFiles, hasScripts };
}

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').trim();
  if (
    !normalized ||
    normalized.length > MAX_PATH_LENGTH ||
    normalized.startsWith('/')
  ) {
    throw new InvalidGeneratedSkillError(`Invalid file path: ${value}`);
  }

  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.startsWith('.')
    )
  ) {
    throw new InvalidGeneratedSkillError(`Unsafe file path: ${value}`);
  }

  return segments.join('/');
}

function validateSkillMarkdown(content: string): void {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new InvalidGeneratedSkillError(
      'SKILL.md must start with YAML frontmatter'
    );
  }

  const frontmatter = match[1] ?? '';
  if (
    !/^name:\s*\S+/m.test(frontmatter) ||
    !/^description:\s*\S+/m.test(frontmatter)
  ) {
    throw new InvalidGeneratedSkillError(
      'SKILL.md frontmatter must contain name and description'
    );
  }
}
