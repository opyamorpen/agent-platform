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

export const createWorkflowNodeSchema = z.object({
  project: refObjectSchema,
  issueType: refObjectSchema,
  status: refObjectSchema,
  agentUUID: z.string().min(1)
});

export const updateWorkflowNodeSchema = createWorkflowNodeSchema;

export type CreateWorkflowDTO = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDTO = z.infer<typeof updateWorkflowSchema>;
export type CreateWorkflowNodeDTO = z.infer<typeof createWorkflowNodeSchema>;
export type UpdateWorkflowNodeDTO = z.infer<typeof updateWorkflowNodeSchema>;
