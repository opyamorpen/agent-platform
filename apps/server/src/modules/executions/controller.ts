import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getWebSession } from '../../lib/web-session.js';
import { requireAdmin } from '../../lib/web-access.js';
import { z } from 'zod';
import {
  cancelIssueExecution,
  deleteDispatchedIssueExecutionRecords,
  getDispatchedIssue,
  DispatchedIssueNotFoundError,
  getDispatchedIssueExecutionHistories,
  getIssueAgentExecutionHistory,
  getIssueExecutionHistory,
  getIssueExecutionFeedback,
  getIssueExecutionLoopTrace,
  retryIssueAgentExecutionHistory,
  getDispatchedIssues,
  IssueAgentExecutionHistoryNotFoundError,
  IssueAgentExecutionHistoryRetryNotAllowedError,
  IssueExecutionCancelNotAllowedError,
  IssueExecutionHistoryNotFoundError
} from './service.js';
import { openExecutionWorkspacePatch } from '../agent-clients/workspace-patch.js';

export async function listDispatchedIssuesHandler(c: Context) {
  const session = await getWebSession(c.req);
  return c.json(success(await getDispatchedIssues(session.teamUUID)));
}

export async function listDispatchedIssueExecutionHistoriesHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Dispatched issue uuid is required',
        'executions.dispatched_issue_uuid_required'
      ),
      400
    );
  }

  try {
    const session = await getWebSession(c.req);
    return c.json(
      success(
        await getDispatchedIssueExecutionHistories(uuid, session.teamUUID)
      )
    );
  } catch (error) {
    if (error instanceof DispatchedIssueNotFoundError) {
      return c.json(
        failure(error.message, 'executions.dispatched_issue_not_found'),
        404
      );
    }

    throw error;
  }
}

export async function getDispatchedIssueHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Dispatched issue uuid is required',
        'executions.dispatched_issue_uuid_required'
      ),
      400
    );
  }

  try {
    const session = await getWebSession(c.req);
    return c.json(success(await getDispatchedIssue(uuid, session.teamUUID)));
  } catch (error) {
    if (error instanceof DispatchedIssueNotFoundError) {
      return c.json(
        failure(error.message, 'executions.dispatched_issue_not_found'),
        404
      );
    }

    throw error;
  }
}

export async function deleteDispatchedIssueHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Dispatched issue uuid is required',
        'executions.dispatched_issue_uuid_required'
      ),
      400
    );
  }

  try {
    const session = await getWebSession(c.req);
    await deleteDispatchedIssueExecutionRecords(uuid, session.teamUUID);
    return c.json(success(true));
  } catch (error) {
    if (error instanceof DispatchedIssueNotFoundError) {
      return c.json(
        failure(error.message, 'executions.dispatched_issue_not_found'),
        404
      );
    }

    throw error;
  }
}

export async function getIssueExecutionHistoryHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Issue execution history uuid is required',
        'executions.issue_execution_history_uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getIssueExecutionHistory(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof IssueExecutionHistoryNotFoundError) {
      return c.json(
        failure(error.message, 'executions.issue_execution_history_not_found'),
        404
      );
    }

    throw error;
  }
}

export async function getIssueExecutionTraceHandler(c: Context) {
  const uuid = c.req.param('uuid');
  if (!uuid) {
    return c.json(
      failure(
        'Issue execution history uuid is required',
        'executions.issue_execution_history_uuid_required'
      ),
      400
    );
  }
  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getIssueExecutionLoopTrace(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof IssueExecutionHistoryNotFoundError) {
      return c.json(
        failure(error.message, 'executions.issue_execution_history_not_found'),
        404
      );
    }
    throw error;
  }
}

export async function getIssueExecutionFeedbackHandler(c: Context) {
  const uuid = c.req.param('uuid');
  if (!uuid) {
    return c.json(
      failure(
        'Issue execution history uuid is required',
        'executions.issue_execution_history_uuid_required'
      ),
      400
    );
  }
  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getIssueExecutionFeedback(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof IssueExecutionHistoryNotFoundError) {
      return c.json(
        failure(error.message, 'executions.issue_execution_history_not_found'),
        404
      );
    }
    throw error;
  }
}

const cancelExecutionSchema = z.object({
  reason: z.string().trim().min(1).max(256).default('管理员手动停止循环')
});

export async function cancelIssueExecutionHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const parsed = cancelExecutionSchema.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!uuid || !parsed.success) {
    return c.json(
      failure(
        'Invalid execution cancellation payload',
        'executions.invalid_cancel_payload'
      ),
      400
    );
  }
  try {
    const { teamUUID } = await requireAdmin(c.req);
    return c.json(
      success(await cancelIssueExecution(uuid, parsed.data.reason, teamUUID))
    );
  } catch (error) {
    if (error instanceof IssueExecutionHistoryNotFoundError) {
      return c.json(
        failure(error.message, 'executions.issue_execution_history_not_found'),
        404
      );
    }
    if (error instanceof IssueExecutionCancelNotAllowedError) {
      return c.json(
        failure(error.message, 'executions.cancel_not_allowed'),
        409
      );
    }
    throw error;
  }
}

export async function getIssueAgentExecutionHistoryHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Issue agent execution history uuid is required',
        'executions.issue_agent_execution_history_uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getIssueAgentExecutionHistory(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof IssueAgentExecutionHistoryNotFoundError) {
      return c.json(
        failure(
          error.message,
          'executions.issue_agent_execution_history_not_found'
        ),
        404
      );
    }

    throw error;
  }
}

export async function retryIssueAgentExecutionHistoryHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure(
        'Issue agent execution history uuid is required',
        'executions.issue_agent_execution_history_uuid_required'
      ),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await retryIssueAgentExecutionHistory(uuid, teamUUID))
    );
  } catch (error) {
    if (error instanceof IssueAgentExecutionHistoryNotFoundError) {
      return c.json(
        failure(
          error.message,
          'executions.issue_agent_execution_history_not_found'
        ),
        404
      );
    }

    if (error instanceof IssueAgentExecutionHistoryRetryNotAllowedError) {
      return c.json(
        failure(
          error.message,
          'executions.issue_agent_execution_retry_not_allowed'
        ),
        409
      );
    }

    throw error;
  }
}

export async function downloadIssueAgentExecutionWorkspacePatchHandler(
  c: Context
) {
  const uuid = c.req.param('uuid');
  if (!uuid) {
    return c.json(failure('Agent execution uuid is required'), 400);
  }
  const { teamUUID } = await getWebSession(c.req);
  const opened = await openExecutionWorkspacePatch(uuid, teamUUID);
  if (!opened?.downloadUrl) {
    return c.json(
      failure(
        'Workspace patch not found',
        'executions.workspace_patch_not_found'
      ),
      404
    );
  }
  return c.redirect(opened.downloadUrl, 302);
}
