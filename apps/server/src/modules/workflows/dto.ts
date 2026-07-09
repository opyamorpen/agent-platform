import { z } from 'zod';
import type { Workflow, WorkflowNode, WorkflowSummary } from '@ones-ai-workflow/shared';

export type WorkflowSummaryDTO = WorkflowSummary;
export type WorkflowDTO = Workflow;
export type WorkflowNodeDTO = WorkflowNode;

const refObjectSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().min(1)
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1)
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional()
}).refine(
  (value) => value.name !== undefined || value.isActive !== undefined,
  {
    message: 'At least one workflow field must be provided'
  }
);

export const createWorkflowNodeSchema = z
  .object({
    triggerType: z.enum(['issue_status', 'manual', 'cron']).default('issue_status'),
    project: refObjectSchema,
    issueType: refObjectSchema,
    status: refObjectSchema.nullable().optional(),
    agentUUID: z.string().min(1),
    condition: z
      .object({
        expression: z.string().default(''),
        description: z.string().default('')
      })
      .default({
        expression: '',
        description: ''
      }),
    schedule: z
      .object({
        cron: z.string().default(''),
        timezone: z.string().default('Asia/Shanghai')
      })
      .nullable()
      .default(null)
  })
  .superRefine((value, ctx) => {
    if (value.triggerType === 'issue_status' && !value.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'Status is required for issue status trigger'
      });
    }

    if (value.triggerType === 'cron' && !value.schedule?.cron.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schedule', 'cron'],
        message: 'Cron expression is required for cron trigger'
      });
    }
  });

export const updateWorkflowNodeSchema = createWorkflowNodeSchema;

export type CreateWorkflowDTO = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDTO = z.infer<typeof updateWorkflowSchema>;
export type CreateWorkflowNodeDTO = z.infer<typeof createWorkflowNodeSchema>;
export type UpdateWorkflowNodeDTO = z.infer<typeof updateWorkflowNodeSchema>;
