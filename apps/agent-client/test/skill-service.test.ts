import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import type { AgentClientTask, SkillManifest } from '@ones-ai-workflow/shared';
import type { Auth } from '../src/auth/index.ts';
import { SkillService } from '../src/skill/service.ts';

test('SkillService ensures only required skills and caches them locally', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-service-'));
  const workingRoot = path.join(tempRoot, 'working');
  const skillsRoot = path.join(tempRoot, 'skills');
  const manifest = createManifest([
    createSkillManifestItem('skill-a', 'Skill A', 3),
    createSkillManifestItem('skill-b', 'Skill B', 4)
  ]);
  const downloadedPaths: string[] = [];
  const extractedTargets: string[] = [];

  try {
    const skillService = new SkillService(
      {
        auth: createAuthStub(),
        serverBaseUrl: 'http://127.0.0.1:3001',
        skillsRoot,
        workingRoot
      },
      {
        fetchSkillsManifest: async () => manifest,
        downloadFileFromServer: async (_serverBaseUrl, _accessToken, downloadPath) => {
          downloadedPaths.push(downloadPath);
          return new Response('archive');
        },
        extractTarArchive: async (_archivePath, outputDirectory) => {
          extractedTargets.push(outputDirectory);
          const skillRoot = path.join(outputDirectory, 'bundle');
          await mkdir(skillRoot, { recursive: true });
          await writeFile(path.join(skillRoot, 'SKILL.md'), '# Skill A', 'utf8');
        },
        now: () => '2026-01-01T00:00:00.000Z'
      }
    );

    await skillService.ensureSkills(createTask('task-1', ['skill-a']));
    await skillService.ensureSkills(createTask('task-1', ['skill-a']));

    const manifestPath = path.join(skillsRoot, 'manifest.json');
    const storedManifest = JSON.parse(
      await readFile(manifestPath, 'utf8')
    ) as SkillManifest;
    const currentSkillRoot = path.join(skillsRoot, 'current', 'skill-a');
    const currentSkillStat = await lstat(currentSkillRoot);
    const cachedMeta = JSON.parse(
      await readFile(path.join(currentSkillRoot, 'meta.json'), 'utf8')
    ) as { version: number; skillRootRelativePath: string };
    const currentSkillMarkdown = await readFile(
      path.join(currentSkillRoot, 'files', 'bundle', 'SKILL.md'),
      'utf8'
    );

    assert.deepEqual(downloadedPaths, ['/skills/skill-a/versions/3/download']);
    assert.equal(extractedTargets.length, 1);
    assert.equal(storedManifest.skills.length, 2);
    assert.ok(currentSkillStat.isDirectory());
    assert.equal(cachedMeta.version, 3);
    assert.equal(cachedMeta.skillRootRelativePath, 'bundle');
    assert.equal(currentSkillMarkdown, '# Skill A');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('SkillService throws when a required skill is missing from manifest', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-service-'));

  try {
    const skillService = new SkillService(
      {
        auth: createAuthStub(),
        serverBaseUrl: 'http://127.0.0.1:3001',
        skillsRoot: path.join(tempRoot, 'skills'),
        workingRoot: path.join(tempRoot, 'working')
      },
      {
        fetchSkillsManifest: async () =>
          createManifest([createSkillManifestItem('skill-a', 'Skill A', 1)]),
        extractTarArchive: async () => {
          throw new Error('should not be called');
        }
      }
    );

    await assert.rejects(
      () => skillService.ensureSkills(createTask('task-2', ['skill-b'])),
      /Required skill not found in manifest: skill-b/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('SkillService mounts ensured skills into the task workspace', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-service-'));
  const workingRoot = path.join(tempRoot, 'working');
  const skillsRoot = path.join(tempRoot, 'skills');

  try {
    const skillService = new SkillService(
      {
        auth: createAuthStub(),
        serverBaseUrl: 'http://127.0.0.1:3001',
        skillsRoot,
        workingRoot
      },
      {
        fetchSkillsManifest: async () =>
          createManifest([createSkillManifestItem('skill-a', 'Skill A', 2)]),
        downloadFileFromServer: async () => new Response('archive'),
        extractTarArchive: async (_archivePath, outputDirectory) => {
          const skillRoot = path.join(outputDirectory, 'skill-a');
          await mkdir(skillRoot, { recursive: true });
          await writeFile(path.join(skillRoot, 'SKILL.md'), '# Skill A', 'utf8');
          await writeFile(path.join(skillRoot, 'README.md'), 'content', 'utf8');
        },
        now: () => '2026-01-01T00:00:00.000Z'
      }
    );

    const workspaceRoot = path.join(workingRoot, 'tasks', 'task-3', 'workspace');
    await mkdir(workspaceRoot, { recursive: true });

    await skillService.ensureSkills(createTask('task-3', ['skill-a']));
    await skillService.mountSkills({
      taskUUID: 'task-3',
      skillUUIDs: ['skill-a']
    });

    const skillRoot = path.join(workspaceRoot, '.agents', 'skills', 'skill-a');
    const skillStat = await lstat(skillRoot);
    const claudeSkillRoot = path.join(workspaceRoot, '.claude', 'skills', 'skill-a');
    const claudeSkillStat = await lstat(claudeSkillRoot);
    const codexSkillMarkdown = await readFile(
      path.join(skillRoot, 'SKILL.md'),
      'utf8'
    );
    const claudeSkillReadme = await readFile(
      path.join(claudeSkillRoot, 'README.md'),
      'utf8'
    );
    const workspaceManifest = JSON.parse(
      await readFile(
        path.join(workspaceRoot, '.agents', 'skills-manifest.json'),
        'utf8'
      )
    ) as SkillManifest;

    assert.ok(skillStat.isDirectory());
    assert.ok(claudeSkillStat.isDirectory());
    assert.equal(codexSkillMarkdown, '# Skill A');
    assert.equal(claudeSkillReadme, 'content');
    assert.deepEqual(
      workspaceManifest.skills.map((skill) => skill.uuid),
      ['skill-a']
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('SkillService mount fails on duplicate workspace skill directory names', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-service-'));
  const workingRoot = path.join(tempRoot, 'working');
  const skillsRoot = path.join(tempRoot, 'skills');

  try {
    const skillService = new SkillService(
      {
        auth: createAuthStub(),
        serverBaseUrl: 'http://127.0.0.1:3001',
        skillsRoot,
        workingRoot
      },
      {
        fetchSkillsManifest: async () =>
          createManifest([
            createSkillManifestItem('skill-a', 'Skill A', 1),
            createSkillManifestItem('skill-b', 'Skill-A', 1)
          ]),
        downloadFileFromServer: async () => new Response('archive'),
        extractTarArchive: async (_archivePath, outputDirectory) => {
          const marker = outputDirectory.includes('skill-a')
            ? 'skill-a'
            : 'skill-b';
          const skillRoot = path.join(outputDirectory, marker);
          await mkdir(skillRoot, { recursive: true });
          await writeFile(path.join(skillRoot, 'SKILL.md'), '# Skill', 'utf8');
        },
        now: () => '2026-01-01T00:00:00.000Z'
      }
    );

    const workspaceRoot = path.join(workingRoot, 'tasks', 'task-4', 'workspace');
    await mkdir(workspaceRoot, { recursive: true });

    await skillService.ensureSkills(createTask('task-4', ['skill-a', 'skill-b']));

    await assert.rejects(
      () =>
        skillService.mountSkills({
          taskUUID: 'task-4',
          skillUUIDs: ['skill-a', 'skill-b']
        }),
      /Duplicate workspace skill directory name: skill-a/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

function createTask(taskUUID: string, skillUUIDs: string[]): AgentClientTask {
  return {
    taskUUID,
    agent: {
      uuid: 'agent-1',
      name: 'Agent 1'
    },
    sourceWorkspace: null,
    skillUUIDs,
    executeOption: {},
    prompt: `prompt for ${taskUUID}`
  };
}

function createAuthStub(overrides?: Partial<Auth>): Auth {
  return {
    async ensureAuthenticated() {},
    getAccessTokenOrThrow() {
      return 'token';
    },
    async clearAuthentication() {},
    ...overrides
  };
}

function createManifest(skills: SkillManifest['skills']): SkillManifest {
  return {
    revision: 'revision-1',
    skills
  };
}

function createSkillManifestItem(uuid: string, name: string, version: number) {
  return {
    uuid,
    name,
    description: `${name} description`,
    version,
    updatedAt: '2026-01-01T00:00:00.000Z',
    downloadPath: `/skills/${uuid}/versions/${version}/download`
  };
}
