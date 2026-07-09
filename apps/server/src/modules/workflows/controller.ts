import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import { getLogger } from '../../lib/logger.js';
import { getWebSession } from '../../lib/web-session.js';
import {
  createWorkflowNodeSchema,
  createWorkflowSchema,
  updateWorkflowNodeSchema,
  updateWorkflowSchema
} from './dto.js';
import {
  createWorkflow,
  createWorkflowNode,
  getWorkflow,
  getWorkflowNodes,
  getWorkflowSummaries,
  removeWorkflow,
  removeWorkflowNode,
  updateWorkflow,
  updateWorkflowNode,
  WorkflowDeletionBlockedError,
  WorkflowNodeExecutorInvalidError,
  WorkflowNodeNotFoundError,
  WorkflowNotFoundError
} from './service.js';

const logger = getLogger('workflows.controller');

export async function listWorkflowsHandler(c: Context) {
  logger.debug('[workflows.controller] listWorkflowsHandler entered', {
    method: c.req.method,
    path: c.req.path
  });

  try {
    const { teamUUID } = await getWebSession(c.req);
    const workflows = await getWorkflowSummaries(teamUUID);
    logger.debug('[workflows.controller] listWorkflowsHandler succeeded', {
      count: workflows.length
    });
    return c.json(success(workflows));
  } catch (error) {
    logger.error('[workflows.controller] listWorkflowsHandler failed', error);
    throw error;
  }
}

export async function getWorkflowHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Workflow uuid is required', 'workflows.uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getWorkflow(uuid, teamUUID)));
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return c.json(failure(error.message, 'workflows.not_found'), 404);
    }

    if (error instanceof WorkflowNodeExecutorInvalidError) {
      return c.json(
        failure(error.message, 'workflows.node_executor_invalid'),
        400
      );
    }

    throw error;
  }
}

export async function createWorkflowHandler(c: Context) {
  const body = await c.req.json().catch(() => null);
  const result = createWorkflowSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      failure('Invalid workflow payload', 'workflows.invalid_payload'),
      400
    );
  }

  const { teamUUID } = await getWebSession(c.req);
  return c.json(
    success(await createWorkflow(result.data, teamUUID)),
    201
  );
}

export async function updateWorkflowHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = updateWorkflowSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure('Workflow uuid is required', 'workflows.uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure('Invalid workflow payload', 'workflows.invalid_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await updateWorkflow(uuid, result.data, teamUUID))
    );
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return c.json(failure(error.message, 'workflows.not_found'), 404);
    }

    throw error;
  }
}

export async function deleteWorkflowHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Workflow uuid is required', 'workflows.uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeWorkflow(uuid, teamUUID);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof WorkflowDeletionBlockedError) {
      return c.json(
        failure(
          '工作流下仍有执行节点，请先删除执行节点后再删除工作流',
          'workflows.deletion_blocked'
        ),
        409
      );
    }

    if (error instanceof WorkflowNotFoundError) {
      return c.json(failure(error.message, 'workflows.not_found'), 404);
    }

    throw error;
  }
}

export async function listWorkflowNodesHandler(c: Context) {
  const workflowUUID = c.req.param('uuid');

  if (!workflowUUID) {
    return c.json(
      failure('Workflow uuid is required', 'workflows.uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(success(await getWorkflowNodes(workflowUUID, teamUUID)));
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return c.json(failure(error.message, 'workflows.not_found'), 404);
    }

    throw error;
  }
}

export async function createWorkflowNodeHandler(c: Context) {
  const workflowUUID = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = createWorkflowNodeSchema.safeParse(body);

  if (!workflowUUID) {
    return c.json(
      failure('Workflow uuid is required', 'workflows.uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure('Invalid workflow node payload', 'workflows.invalid_node_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await createWorkflowNode(workflowUUID, result.data, teamUUID)),
      201
    );
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return c.json(failure(error.message, 'workflows.not_found'), 404);
    }

    if (error instanceof WorkflowNodeExecutorInvalidError) {
      return c.json(
        failure(error.message, 'workflows.node_executor_invalid'),
        400
      );
    }

    throw error;
  }
}

export async function updateWorkflowNodeHandler(c: Context) {
  const uuid = c.req.param('uuid');
  const body = await c.req.json().catch(() => null);
  const result = updateWorkflowNodeSchema.safeParse(body);

  if (!uuid) {
    return c.json(
      failure('Workflow node uuid is required', 'workflows.node_uuid_required'),
      400
    );
  }

  if (!result.success) {
    return c.json(
      failure('Invalid workflow node payload', 'workflows.invalid_node_payload'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    return c.json(
      success(await updateWorkflowNode(uuid, result.data, teamUUID))
    );
  } catch (error) {
    if (error instanceof WorkflowNodeNotFoundError) {
      return c.json(failure(error.message, 'workflows.node_not_found'), 404);
    }

    if (error instanceof WorkflowNodeExecutorInvalidError) {
      return c.json(
        failure(error.message, 'workflows.node_executor_invalid'),
        400
      );
    }

    throw error;
  }
}

export async function deleteWorkflowNodeHandler(c: Context) {
  const uuid = c.req.param('uuid');

  if (!uuid) {
    return c.json(
      failure('Workflow node uuid is required', 'workflows.node_uuid_required'),
      400
    );
  }

  try {
    const { teamUUID } = await getWebSession(c.req);
    await removeWorkflowNode(uuid, teamUUID);
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof WorkflowNodeNotFoundError) {
      return c.json(failure(error.message, 'workflows.node_not_found'), 404);
    }

    throw error;
  }
}
