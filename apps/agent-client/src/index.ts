import { mkdir } from 'node:fs/promises';
import { AuthService } from './auth/index.js';
import { env } from './config.js';
import { CodexHomeReporter, CodexHomeService } from './codex-home/index.js';
import { logger } from './logger.js';
import { Scheduler } from './scheduler/index.js';
import { SkillService } from './skill/index.js';
import { TaskServerService } from './task-server/index.js';
import { TaskStoreFileService } from './task-store/index.js';
import { WorkspaceService } from './workspace/index.js';

async function main() {
  await mkdir(env.workingRoot, { recursive: true });
  await mkdir(env.sourceWorkspacesRoot, { recursive: true });
  await mkdir(env.skillsRoot, { recursive: true });

  logger.info('Agent client configuration loaded', {
    clientUUID: env.clientUUID,
    clientName: env.clientName,
    clientVersion: env.clientVersion,
    serverBaseUrl: env.serverBaseUrl,
    concurrency: env.concurrency,
    defaultAgent: env.defaultAgent,
    workingRoot: env.workingRoot,
    sourceWorkspacesRoot: env.sourceWorkspacesRoot,
    skillsRoot: env.skillsRoot,
    logLevel: env.logLevel,
    codexHomes: env.codexHomes,
    codexUsesApiKey: env.codexUsesApiKey,
    codexBaseUrl: env.codexBaseUrl ?? null,
    codexModel: env.codexModel,
    codexReasoningEffort: env.codexReasoningEffort,
    hermesCommandTemplateConfigured: Boolean(env.hermesCommandTemplate)
  });

  const auth = new AuthService({
    clientUUID: env.clientUUID,
    clientName: env.clientName,
    clientVersion: env.clientVersion,
    serverBaseUrl: env.serverBaseUrl,
    workingRoot: env.workingRoot
  });

  const taskStore = new TaskStoreFileService({
    workingRoot: env.workingRoot,
    maxConcurrency: env.concurrency
  });

  const taskServer = new TaskServerService({
    serverBaseUrl: env.serverBaseUrl,
    auth
  });

  const workspace = new WorkspaceService({
    workingRoot: env.workingRoot,
    sourceWorkspacesRoot: env.sourceWorkspacesRoot
  });

  const skill = new SkillService({
    auth,
    serverBaseUrl: env.serverBaseUrl,
    skillsRoot: env.skillsRoot,
    workingRoot: env.workingRoot
  });
  const codexHome = new CodexHomeService(env.codexHomes);
  if (env.defaultAgent === 'codex' && !env.codexUsesApiKey) {
    const codexHomeReporter = new CodexHomeReporter(codexHome);
    codexHomeReporter.start();
  }

  const scheduler = new Scheduler(
    auth,
    taskStore,
    taskServer,
    workspace,
    skill,
    codexHome,
    env.defaultAgent,
    {
      codexApiKey: env.codexApiKey,
      codexBaseUrl: env.codexBaseUrl,
      codexModel: env.codexModel,
      codexReasoningEffort: env.codexReasoningEffort,
      hermesCommandTemplate: env.hermesCommandTemplate
    }
  );

  await scheduler.run();
}

main().catch((error) => {
  logger.error('Agent client exited with error', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
