import { cp, lstat, mkdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { SkillManifest } from '@ones-ai-workflow/shared';
import {
  buildWorkspaceSkillDirectoryName,
  getRequiredSkillManifestItems,
  getSkillsCurrentRoot,
  getSkillsManifestPath,
  type CachedSkillMeta,
  readCachedSkillMeta,
  readLocalSkillManifest,
  resolveCachedSkillRootPath
} from './cache.js';

export async function mountSkillsIntoWorkspace(options: {
  workspaceRoot: string;
  skillsRoot: string;
  skillUUIDs: string[];
}): Promise<void> {
  await ensureDirectoryExists(options.workspaceRoot);

  const agentsRoot = path.join(options.workspaceRoot, '.agents');
  const codexSkillsRoot = path.join(agentsRoot, 'skills');
  const claudeRoot = path.join(options.workspaceRoot, '.claude');
  const claudeSkillsRoot = path.join(claudeRoot, 'skills');
  await mkdir(agentsRoot, { recursive: true });
  await mkdir(claudeRoot, { recursive: true });
  await Promise.all([
    rm(codexSkillsRoot, { recursive: true, force: true }),
    rm(claudeSkillsRoot, { recursive: true, force: true })
  ]);
  await Promise.all([
    mkdir(codexSkillsRoot, { recursive: true }),
    mkdir(claudeSkillsRoot, { recursive: true })
  ]);

  if (options.skillUUIDs.length === 0) {
    await writeWorkspaceSkillsManifest(path.join(agentsRoot, 'skills-manifest.json'), {
      revision: '',
      skills: []
    });
    return;
  }

  const manifestPath = getSkillsManifestPath(options.skillsRoot);
  const manifest = await readLocalSkillManifest(manifestPath);

  if (!manifest) {
    throw new Error(`Local skill manifest not found: ${manifestPath}`);
  }

  const requiredSkills = getRequiredSkillManifestItems(options.skillUUIDs, manifest);
  const currentSkillsRoot = getSkillsCurrentRoot(options.skillsRoot);
  const seenWorkspaceSkillDirectoryNames = new Set<string>();
  const mountedSkills: MountedSkill[] = [];

  for (const skill of requiredSkills) {
    const currentSkillRoot = path.join(currentSkillsRoot, skill.uuid);
    const cachedMeta = await readCachedSkillMeta(currentSkillRoot);

    if (cachedMeta.version !== skill.version) {
      throw new Error(
        `Current skill version mismatch: ${skill.uuid} (${cachedMeta.version} != ${skill.version})`
      );
    }

    const workspaceSkillDirectoryName = buildWorkspaceSkillDirectoryName(cachedMeta);

    if (seenWorkspaceSkillDirectoryNames.has(workspaceSkillDirectoryName)) {
      throw new Error(
        `Duplicate workspace skill directory name: ${workspaceSkillDirectoryName}`
      );
    }

    const skillRootPath = resolveCachedSkillRootPath(currentSkillRoot, cachedMeta);
    seenWorkspaceSkillDirectoryNames.add(workspaceSkillDirectoryName);
    mountedSkills.push({
      cachedMeta,
      skillRootPath,
      workspaceSkillDirectoryName
    });
  }

  for (const mountedSkill of mountedSkills) {
    await Promise.all([
      cp(
        mountedSkill.skillRootPath,
        path.join(codexSkillsRoot, mountedSkill.workspaceSkillDirectoryName),
        { recursive: true }
      ),
      cp(
        mountedSkill.skillRootPath,
        path.join(claudeSkillsRoot, mountedSkill.workspaceSkillDirectoryName),
        { recursive: true }
      )
    ]);
  }

  await writeWorkspaceSkillsManifest(path.join(agentsRoot, 'skills-manifest.json'), {
    revision: manifest.revision,
    skills: requiredSkills
  });
}

async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  const stat = await lstat(directoryPath).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(`Workspace root is not ready: ${directoryPath}`);
  }
}

async function writeWorkspaceSkillsManifest(
  manifestPath: string,
  manifest: SkillManifest
): Promise<void> {
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

interface MountedSkill {
  cachedMeta: CachedSkillMeta;
  skillRootPath: string;
  workspaceSkillDirectoryName: string;
}
