import { z } from 'zod';

const agentMutationSchema = z
  .object({
    name: z.string().trim(),
    workspaceUUID: z.string().trim().min(1).nullable().optional(),
    skillUUIDs: z.array(z.string().trim().min(1)).optional(),
    executorUUID: z.string().trim().min(1).nullable().optional(),
    executorName: z.string().trim().min(1).nullable().optional()
  })
  .superRefine((value, ctx) => {
    const hasExecutorUUID = Boolean(value.executorUUID);
    const hasExecutorName = Boolean(value.executorName);

    if (hasExecutorUUID !== hasExecutorName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasExecutorUUID ? ['executorName'] : ['executorUUID'],
        message: 'Executor binding requires both uuid and name'
      });
    }
  });

export const createAgentSchema = agentMutationSchema;

export const updateAgentSchema = agentMutationSchema;

export const duplicateAgentSchema = z.object({
  name: z.string().trim().min(1).optional()
});

export const agentIOFieldSchema = z.object({
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  alias: z.string().trim().min(1),
  description: z.string()
});

const agentFieldMetaSchema = z.object({
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  valueType: z.string().trim().min(1),
  referenceObjectType: z.string().trim().min(1).nullable()
});

export const agentIssueInputFieldSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    kind: z.literal('issue_field').optional(),
    field: agentFieldMetaSchema,
    description: z.string(),
    subFields: z.array(agentIssueInputFieldSchema).default([])
  })
);

export const agentWikiPageInputSchema = z.object({
  kind: z.literal('wiki_page'),
  field: agentFieldMetaSchema,
  description: z.string(),
  subFields: z.tuple([]).default([])
});

export const agentInputFieldSchema = z.union([
  agentIssueInputFieldSchema,
  agentWikiPageInputSchema
]);

export const agentCreateSchema = z.object({
  alias: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string(),
  fields: z.array(agentIOFieldSchema).default([])
});

export const agentOutputSetValueFieldSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    kind: z.literal('issue_field').optional(),
    mode: z.literal('set_value'),
    field: agentFieldMetaSchema,
    description: z.string(),
    subFields: z.array(agentOutputSetValueFieldSchema).default([])
  })
);

export const agentWikiPageOutputFieldSchema = z.object({
  kind: z.literal('wiki_page'),
  mode: z.literal('wiki_page'),
  field: agentFieldMetaSchema,
  description: z.string(),
  subFields: z.tuple([]).default([])
});

export const agentOutputFieldSchema = z.union([
  agentOutputSetValueFieldSchema,
  agentWikiPageOutputFieldSchema
]);

function validateInputFieldNode(
  value: z.infer<typeof agentInputFieldSchema>,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
  depth: number
) {
  if (value.kind === 'wiki_page') {
    if (
      value.field.referenceObjectType !== 'wiki_page' &&
      value.field.referenceObjectType !== 'wiki'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'field', 'referenceObjectType'],
        message: 'Wiki input must use a Wiki page reference field'
      });
    }
    return;
  }

  if (depth >= 2 && value.subFields.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'subFields'],
      message: 'Input fields support at most two levels'
    });
  }

  if (
    value.subFields.length > 0 &&
    value.field.referenceObjectType !== 'issue'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'field', 'referenceObjectType'],
      message: 'Only issue reference fields can configure sub fields'
    });
  }

  for (const [index, subField] of value.subFields.entries()) {
    validateInputFieldNode(
      subField,
      ctx,
      [...path, 'subFields', index],
      depth + 1
    );
  }
}

function validateOutputSetValueFieldNode(
  value: z.infer<typeof agentOutputFieldSchema>,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
  depth: number
) {
  if (value.kind === 'wiki_page') {
    if (
      value.field.referenceObjectType !== 'wiki_page' &&
      value.field.referenceObjectType !== 'wiki'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'field', 'referenceObjectType'],
        message: 'Wiki output must use a Wiki page reference field'
      });
    }
    return;
  }

  if (depth >= 2 && value.subFields.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'subFields'],
      message: 'Output fields support at most two levels'
    });
  }

  if (
    value.subFields.length > 0 &&
    value.field.valueType !== 'single_reference_object' &&
    value.field.valueType !== 'multi_reference_object'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'field', 'valueType'],
      message: 'Only issue reference fields can configure sub fields'
    });
  }

  if (
    value.subFields.length > 0 &&
    value.field.referenceObjectType !== 'issue'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'field', 'referenceObjectType'],
      message: 'Only issue reference fields can configure sub fields'
    });
  }

  for (const [index, subField] of value.subFields.entries()) {
    validateOutputSetValueFieldNode(
      subField,
      ctx,
      [...path, 'subFields', index],
      depth + 1
    );
  }
}

export const agentConfigSchema = z
  .object({
    description: z.string(),
    prompt: z.string(),
    inputs: z.array(agentInputFieldSchema),
    outputs: z.array(agentOutputFieldSchema),
    knowledgeSourceUUIDs: z.array(z.string().trim().min(1)).max(5).default([])
  })
  .superRefine((value, ctx) => {
    for (const [index, input] of value.inputs.entries()) {
      validateInputFieldNode(input, ctx, ['inputs', index], 1);
    }

    for (const [index, output] of value.outputs.entries()) {
      validateOutputSetValueFieldNode(output, ctx, ['outputs', index], 1);
    }

    if (
      value.outputs.filter((output) => output.kind === 'wiki_page').length > 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outputs'],
        message: 'Agent supports at most one Wiki page output'
      });
    }
  });

export const saveAgentDraftSchema = z.object({
  config: agentConfigSchema
});

export const agentPromptPreviewSchema = z.object({
  config: agentConfigSchema,
  workspaceUUID: z.string().trim().min(1).nullable().optional()
});

export const agentPromptRecommendationSchema = z.object({
  name: z.string().trim().min(1).max(256),
  description: z.string().max(20_000),
  skillUUIDs: z.array(z.string().trim().min(1)).max(20),
  knowledgeSourceUUIDs: z.array(z.string().trim().min(1)).max(5).default([]),
  inputs: z.array(agentInputFieldSchema),
  outputs: z.array(agentOutputFieldSchema)
});

export const publishAgentSchema = z.object({
  createdBy: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional()
});

export type SaveAgentDraftDTO = z.infer<typeof saveAgentDraftSchema>;
export type AgentPromptPreviewDTO = z.infer<typeof agentPromptPreviewSchema>;
export type AgentPromptRecommendationDTO = z.infer<
  typeof agentPromptRecommendationSchema
>;
export type PublishAgentDTO = z.infer<typeof publishAgentSchema>;
export type CreateAgentDTO = z.infer<typeof createAgentSchema>;
export type UpdateAgentDTO = z.infer<typeof updateAgentSchema>;
export type DuplicateAgentDTO = z.infer<typeof duplicateAgentSchema>;
