import { z } from 'zod';
import type {
  Workflow,
  WorkflowNode,
  WorkflowSummary
} from '@ones-ai-workflow/shared';

export type WorkflowSummaryDTO = WorkflowSummary;
export type WorkflowDTO = Workflow;
export type WorkflowNodeDTO = WorkflowNode;

const refObjectSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().min(1)
});

const workflowNodePostActionSchema = z.object({
  type: z.literal('transition_issue_status'),
  targetStatus: refObjectSchema
});

const workflowNodeRevisionContextSchema = z.object({
  enabled: z.boolean().default(false)
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1)
});

export const updateWorkflowSchema = z
  .object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: 'At least one workflow field must be provided'
  });

export const createWorkflowNodeSchema = z
  .object({
    project: refObjectSchema,
    issueType: refObjectSchema,
    status: refObjectSchema,
    agentUUID: z.string().min(1),
    postActions: z.array(workflowNodePostActionSchema).length(1),
    revisionContext: workflowNodeRevisionContextSchema.default({
      enabled: false
    })
  })
  .superRefine((value, context) => {
    const transitionAction = value.postActions[0];
    if (
      transitionAction?.type === 'transition_issue_status' &&
      transitionAction.targetStatus.uuid === value.status.uuid
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postActions', 0, 'targetStatus'],
        message: 'Post-action target status must differ from trigger status'
      });
    }
  });

export const updateWorkflowNodeSchema = createWorkflowNodeSchema;

export type CreateWorkflowDTO = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDTO = z.infer<typeof updateWorkflowSchema>;
export type CreateWorkflowNodeDTO = z.infer<typeof createWorkflowNodeSchema>;
export type UpdateWorkflowNodeDTO = z.infer<typeof updateWorkflowNodeSchema>;
