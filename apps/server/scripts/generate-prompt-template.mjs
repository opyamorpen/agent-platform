import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, '..');
const sourcePath = path.join(serverRoot, 'src', 'modules', 'agents', 'prompt-template.md');
const outputPath = path.join(
  serverRoot,
  'src',
  'modules',
  'agents',
  'prompt-template.generated.ts'
);

const template = await readFile(sourcePath, 'utf8');
const output = [
  '// This file is generated from prompt-template.md. Do not edit manually.',
  `export const AGENT_PROMPT_TEMPLATE = ${JSON.stringify(template)};`,
  ''
].join('\n');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, 'utf8');
