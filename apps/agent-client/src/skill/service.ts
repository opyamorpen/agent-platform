import * as path from 'node:path';
import type { AgentClientTask, SkillManifest } from '@ones-ai-workflow/shared';
import { downloadFileFromServer, fetchSkillsManifest } from '../api.js';
import type { Auth } from '../auth/index.js';
import {
  defaultSkillCacheDependencies,
  ensureRequiredSkillVersionsCached,
  getRequiredSkillManifestItems,
  getSkillsManifestPath,
  type SkillCacheDependencies,
  writeLocalSkillManifest
} from './cache.js';
import type { MountSkillsInput, Skill } from './index.js';
import { mountSkillsIntoWorkspace } from './mount.js';

export interface SkillServiceOptions {
  auth: Auth;
  serverBaseUrl: string;
  skillsRoot: string;
  workingRoot: string;
}

export interface SkillServiceDependencies extends SkillCacheDependencies {
  fetchSkillsManifest: typeof fetchSkillsManifest;
}

const defaultDependencies: SkillServiceDependencies = {
  fetchSkillsManifest,
  downloadFileFromServer,
  extractTarArchive: defaultSkillCacheDependencies.extractTarArchive,
  now: () => new Date().toISOString()
};

export class SkillService implements Skill {
  private readonly dependencies: SkillServiceDependencies;

  constructor(
    private readonly options: SkillServiceOptions,
    dependencies?: Partial<SkillServiceDependencies>
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies
    };
  }

  async ensureSkills(task: AgentClientTask): Promise<void> {
    const requiredSkillUUIDs = dedupeSkillUUIDs(task.skillUUIDs);

    if (requiredSkillUUIDs.length === 0) {
      return;
    }

    await this.options.auth.ensureAuthenticated();
    const accessToken = this.options.auth.getAccessTokenOrThrow();
    const manifest = await this.dependencies.fetchSkillsManifest(
      this.options.serverBaseUrl,
      accessToken
    );
    const requiredSkills = getRequiredSkillManifestItems(
      requiredSkillUUIDs,
      manifest
    );

    await ensureRequiredSkillVersionsCached({
      serverBaseUrl: this.options.serverBaseUrl,
      accessToken,
      skillsRoot: this.options.skillsRoot,
      skills: requiredSkills,
      dependencies: {
        downloadFileFromServer: this.dependencies.downloadFileFromServer,
        extractTarArchive: this.dependencies.extractTarArchive,
        now: this.dependencies.now
      }
    });
    await writeLocalSkillManifest(
      getSkillsManifestPath(this.options.skillsRoot),
      manifest
    );
  }

  async mountSkills(input: MountSkillsInput): Promise<void> {
    await mountSkillsIntoWorkspace({
      workspaceRoot: this.getTaskWorkspaceRoot(input.taskUUID),
      skillsRoot: this.options.skillsRoot,
      skillUUIDs: dedupeSkillUUIDs(input.skillUUIDs)
    });
  }

  private getTaskWorkspaceRoot(taskUUID: string): string {
    return path.join(this.options.workingRoot, 'tasks', taskUUID, 'workspace');
  }
}

function dedupeSkillUUIDs(skillUUIDs: string[]): string[] {
  return [...new Set(skillUUIDs.filter((skillUUID) => skillUUID.trim() !== ''))];
}
