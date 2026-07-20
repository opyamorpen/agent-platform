import type {
  AgentClientTask,
  AgentTokenUsage,
  AgentClientTaskAttachmentOutput,
  AgentClientTaskReport,
  AgentClientTaskStatus
} from '@ones-ai-workflow/shared';

export interface TaskStoreService {
  reload(): Promise<void>;
  getAvailableSlots(): number;
  getAvailableClaimSlots(): number;
  insertNewTasks(tasks: AgentClientTask[]): void;
  listRunnableTasks(): AgentClientTask[];
  getLatestReports(): AgentClientTaskReport[];
  markTaskReported(taskUUID: string): void;
  markTaskReportBlocked(taskUUID: string, error: string): void;
  removeTasks(taskUUIDs: string[]): void;
  deferTask(
    taskUUID: string,
    appendLogs?: string
  ): { retryAfterMs: number; nextAttemptAt: string };
  updateTaskStatus(
    taskUUID: string,
    status: AgentClientTaskStatus,
    appendLogs?: string,
    executeResult?: string,
    attachmentUploads?: AgentClientTaskAttachmentOutput[],
    usage?: AgentTokenUsage | null
  ): void;
}

export interface TaskStore {
  agentClientTask: AgentClientTask;
  status: AgentClientTaskStatus;
  result: string;
  logs: string;
}
