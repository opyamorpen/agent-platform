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

const workflowNodeLoopPolicySchema = z.object({
  enabled: z.boolean().default(false),
  maxAttempts: z.number().int().min(1).max(5).default(3),
  maxDurationMinutes: z.number().int().min(1).max(120).default(30),
  maxTotalTokens: z.number().int().min(1_000).max(1_000_000).default(100_000),
  escalationTargetStatus: refObjectSchema.nullable().default(null)
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
    }),
    loopPolicy: workflowNodeLoopPolicySchema.default({
      enabled: false,
      maxAttempts: 3,
      maxDurationMinutes: 30,
      maxTotalTokens: 100_000,
      escalationTargetStatus: null
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

    if (!value.loopPolicy.enabled) {
      return;
    }

    const escalationTargetStatus = value.loopPolicy.escalationTargetStatus;
    if (!escalationTargetStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loopPolicy', 'escalationTargetStatus'],
        message: 'Loop policy requires an escalation target status'
      });
      return;
    }

    if (escalationTargetStatus.uuid === value.status.uuid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loopPolicy', 'escalationTargetStatus'],
        message: 'Escalation target status must differ from trigger status'
      });
    }

    if (escalationTargetStatus.uuid === transitionAction?.targetStatus.uuid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['loopPolicy', 'escalationTargetStatus'],
        message: 'Escalation target status must differ from success status'
      });
    }
  });

export const updateWorkflowNodeSchema = createWorkflowNodeSchema;

export type CreateWorkflowDTO = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDTO = z.infer<typeof updateWorkflowSchema>;
export type CreateWorkflowNodeDTO = z.infer<typeof createWorkflowNodeSchema>;
export type UpdateWorkflowNodeDTO = z.infer<typeof updateWorkflowNodeSchema>;
