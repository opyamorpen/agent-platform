import type { AgentClientTask } from '@ones-ai-workflow/shared';
import type {
  ExecuteAgentType,
  ModelReasoningEffort
} from '../agent-session/types.js';
import { getCodexHomeRetryDelayMs } from '../codex-home/index.js';
import { logger } from '../logger.js';
import { type Auth } from '../auth/index.js';
import { type CodexHomeService } from '../codex-home/index.js';
import { type Skill } from '../skill/index.js';
import {
  TaskServerAuthenticationError,
  TaskServerReportError,
  TaskServerRetryableError,
  type TaskServer
} from '../task-server/index.js';
import { type TaskStore } from '../task-store/index.js';
import { TaskRun } from '../task-run/index.js';
import { type Workspace } from '../workspace/index.js';

const POLL_INTERVAL_MS = 5_000;

export type SchedulerOptions = {
  codexApiKey?: string;
  codexBaseUrl?: string;
  codexModel?: string;
  codexReasoningEffort?: ModelReasoningEffort;
};

export class Scheduler {
  auth: Auth;
  taskStore: TaskStore;
  taskServer: TaskServer;
  workspace: Workspace;
  skill: Skill;
  codexHome: CodexHomeService;
  defaultAgentType: ExecuteAgentType;
  codexApiKey?: string;
  codexBaseUrl?: string;
  codexModel?: string;
  codexReasoningEffort?: ModelReasoningEffort;
  reloadPromise: Promise<void>;
  consecutiveErrors = 0;
  constructor(
    auth: Auth,
    taskStore: TaskStore,
    taskServer: TaskServer,
    workspace: Workspace,
    skill: Skill,
    codexHome: CodexHomeService,
    defaultAgentType: ExecuteAgentType = 'codex',
    options: SchedulerOptions = {}
  ) {
    this.auth = auth;
    this.taskStore = taskStore;
    this.taskServer = taskServer;
    this.workspace = workspace;
    this.skill = skill;
    this.codexHome = codexHome;
    this.defaultAgentType = defaultAgentType;
    this.codexApiKey = options.codexApiKey;
    this.codexBaseUrl = options.codexBaseUrl;
    this.codexModel = options.codexModel;
    this.codexReasoningEffort = options.codexReasoningEffort;
    this.reloadPromise = this.taskStore.reload();
  }
  async run(): Promise<void> {
    await this.reloadPromise;
    while (true) {
      const loopStartedAt = Date.now();
      let targetIntervalMs = POLL_INTERVAL_MS;
      try {
        await this.auth.ensureAuthenticated();
        await this.flushLatestReports();
        await this.claimNewTasks();
        await this.startCreatedTasks();
        this.consecutiveErrors = 0;
      } catch (error) {
        targetIntervalMs = await this.handleLoopError(error);
      }

      const elapsedMs = Date.now() - loopStartedAt;
      const waitMs = Math.max(targetIntervalMs - elapsedMs, 0);

      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }
  }

  private async handleLoopError(error: unknown): Promise<number> {
    if (error instanceof TaskServerAuthenticationError) {
      logger.warn('Scheduler authentication invalid, clearing local auth state', {
        error: error.message
      });
      await this.auth.clearAuthentication();
      this.consecutiveErrors = 0;
      return POLL_INTERVAL_MS;
    }

    this.consecutiveErrors += 1;
    const retryAfterMs = getCodexHomeRetryDelayMs(this.consecutiveErrors);

    if (error instanceof TaskServerRetryableError) {
      logger.warn('Scheduler tick failed with retryable error', {
        consecutiveErrors: this.consecutiveErrors,
        error: error.message,
        retryAfterMs
      });
    } else if (error instanceof TaskServerReportError) {
      logger.warn('Scheduler tick failed while reporting task status', {
        consecutiveErrors: this.consecutiveErrors,
        error: error.message,
        retryAfterMs
      });
    } else {
      logger.error('Scheduler tick failed', {
        consecutiveErrors: this.consecutiveErrors,
        error: error instanceof Error ? error.message : String(error),
        retryAfterMs
      });
    }

    return retryAfterMs;
  }

  private async flushLatestReports(): Promise<void> {
    const latestReports = this.taskStore.getLatestReports();

    for (const report of latestReports) {
      try {
        await this.taskServer.reportTasks({
          tasks: [report]
        });
      } catch (error) {
        if (error instanceof TaskServerReportError) {
          logger.warn('Discarding task after non-retryable report rejection', {
            taskUUID: report.taskUUID,
            status: report.status,
            error: error.message
          });
          this.taskStore.removeTasks([report.taskUUID]);
          continue;
        }

        throw error;
      }

      if (report.status === 'success' || report.status === 'failure') {
        this.taskStore.markTaskReported(report.taskUUID);
      }
    }
  }

  private async claimNewTasks(): Promise<void> {
    const availableSlots = this.taskStore.getAvailableClaimSlots();
    if (availableSlots > 0) {
      const claimedTasks = await this.taskServer.claimTasks({
        availableSlots
      });
      this.taskStore.insertNewTasks(claimedTasks);
    }
  }

  private async startCreatedTasks(): Promise<void> {
    const runnableTasks = this.taskStore.listRunnableTasks();
    for (const task of runnableTasks) {
      await this.startTask(task);
    }
  }

  protected async startTask(task: AgentClientTask): Promise<void> {
    logger.info('Task accepted', {
      taskUUID: task.taskUUID,
      agentUUID: task.agent.uuid,
      agentName: task.agent.name,
      defaultAgentType: this.defaultAgentType,
      sourceWorkspaceUUID: task.sourceWorkspace?.uuid ?? null,
      skillUUIDs: task.skillUUIDs,
      promptLength: task.prompt.length
    });

    if (this.defaultAgentType === 'codex') {
      if (this.codexApiKey) {
        await this.workspace.ensureSourceWorkspace(task);
        await this.skill.ensureSkills(task);
        await this.runTask(task, undefined, '[codex-auth] using API key');
        return;
      }

      const selectedHome = await this.codexHome.selectHome();

      if (selectedHome.kind === 'deferred') {
        const deferResult = this.taskStore.deferTask(
          task.taskUUID,
          selectedHome.message
        );

        logger.info('Task deferred waiting for codex home availability', {
          taskUUID: task.taskUUID,
          retryAfterMs: deferResult.retryAfterMs,
          nextAttemptAt: deferResult.nextAttemptAt
        });
        return;
      }

      await this.workspace.ensureSourceWorkspace(task);
      await this.skill.ensureSkills(task);
      await this.runTask(task, selectedHome.homePath, selectedHome.message);
      return;
    }

    await this.workspace.ensureSourceWorkspace(task);
    await this.skill.ensureSkills(task);
    await this.runTask(
      task,
      undefined,
      `[agent-session] using default agent: ${this.defaultAgentType}`
    );
  }

  protected runTask(
    task: AgentClientTask,
    codexHomePath: string | undefined,
    startLog: string
  ): void {
    const isCodexTask = this.defaultAgentType === 'codex';
    const taskModelProfile = task.modelProfile;
    const profileApiKey =
      taskModelProfile?.apiKeySecretName
        ? process.env[taskModelProfile.apiKeySecretName]
        : undefined;
    const taskReasoningEffort =
      taskModelProfile?.reasoningEffort &&
      ['minimal', 'low', 'medium', 'high', 'xhigh'].includes(
        taskModelProfile.reasoningEffort
      )
        ? (taskModelProfile.reasoningEffort as ModelReasoningEffort)
        : undefined;
    const taskRun = new TaskRun({
      taskUUID: task.taskUUID,
      sourceWorkspaceUUID: task.sourceWorkspace?.uuid ?? null,
      skillUUIDs: task.skillUUIDs,
      prompt: task.prompt,
      executeAgentType: this.defaultAgentType,
      codexHomePath,
      codexApiKey: profileApiKey ?? this.codexApiKey,
      codexBaseUrl: taskModelProfile?.baseURL ?? this.codexBaseUrl,
      model: taskModelProfile?.model ?? (isCodexTask ? this.codexModel : undefined),
      modelReasoningEffort: isCodexTask
        ? taskReasoningEffort ?? this.codexReasoningEffort
        : undefined,
      executeOption: task.executeOption
    }, this.workspace, this.skill, {
      fetchTaskRuntimeEnv: async (taskUUID) =>
        this.taskServer.fetchTaskRuntimeEnv({
          taskUUID
        }),
      uploadTaskAttachments: async (taskUUID, files) =>
        this.taskServer.uploadTaskAttachments({
          taskUUID,
          files
        })
    });

    this.taskStore.updateTaskStatus(task.taskUUID, 'running', startLog);
    logger.info('Task execution started', {
      taskUUID: task.taskUUID,
      executeAgentType: this.defaultAgentType,
      codexHomePath,
      sourceWorkspaceUUID: task.sourceWorkspace?.uuid ?? null,
      skillCount: task.skillUUIDs.length
    });

    try {
      taskRun.start({
        onProgress: ({ logs }) => {
          this.taskStore.updateTaskStatus(task.taskUUID, 'running', logs);
        },
        onError: (error, usage) => {
          this.taskStore.updateTaskStatus(
            task.taskUUID,
            'failure',
            error.message,
            undefined,
            undefined,
            usage
          );
          logger.error('Task execution failed', {
            taskUUID: task.taskUUID,
            error: error.message
          });
        },
        onFinish: (result, attachmentUploads, usage) => {
          this.taskStore.updateTaskStatus(
            task.taskUUID,
            'success',
            undefined,
            result,
            attachmentUploads,
            usage
          );
          logger.info('Task execution succeeded', {
            taskUUID: task.taskUUID,
            resultLength: result.length
          });
        }
      });
    } catch (error) {
      this.taskStore.updateTaskStatus(
        task.taskUUID,
        'failure',
        error instanceof Error ? error.message : String(error)
      );
      logger.error('Task execution failed', {
        taskUUID: task.taskUUID,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
