import { z } from 'zod';
import { trimTrailingSlash } from '../shared/utils.js';

export const onesOpenApiConfigSchema = z.object({
  baseUrl: z
    .string()
    .url('ONES_BASE_URL must be a valid URL')
    .transform(trimTrailingSlash),
  teamId: z.string().min(1, 'team_uuid request header is required'),
  accessToken: z.string().min(1, 'OpenAPI access token is required')
});

export const onesOpenApiPageInfoSchema = z.object({
  hasNextPage: z.boolean().optional(),
  startCursor: z.string().optional(),
  endCursor: z.string().optional(),
  totalCount: z.number().optional(),
  count: z.number().optional(),
  has_next_page: z.boolean().optional(),
  start_cursor: z.string().optional(),
  end_cursor: z.string().optional(),
  total_count: z.number().optional()
});

export const onesOpenApiIssueFieldOptionSchema = z
  .object({
    id: z.string().optional(),
    value: z.string().optional(),
    name: z.string().optional()
  })
  .passthrough();

export const onesOpenApiIssueFieldSchema = z
  .object({
    id: z.string().optional(),
    uuid: z.string().optional(),
    name: z.string().min(1),
    fieldType: z.string().optional(),
    field_type: z.string().optional(),
    valueType: z.string().optional(),
    value_type: z.string().optional(),
    valueTypeDesc: z.string().optional(),
    value_type_desc: z.string().optional(),
    builtIn: z.boolean().optional(),
    built_in: z.boolean().optional(),
    options: z.array(onesOpenApiIssueFieldOptionSchema).optional()
  })
  .passthrough();

export const onesOpenApiIssueFieldsEnvelopeSchema = z
  .object({
    result: z.string().optional(),
    errorCode: z.string().optional(),
    errorMsg: z.string().optional(),
    errorData: z.unknown().optional(),
    data: z
      .object({
        list: z.array(onesOpenApiIssueFieldSchema).default([]),
        pageInfo: onesOpenApiPageInfoSchema.optional(),
        page_info: onesOpenApiPageInfoSchema.optional()
      })
      .optional()
  })
  .passthrough();

export const onesOpenApiFieldOptionItemSchema = z
  .object({
    uuid: z.string().min(1).optional(),
    id: z.string().min(1).optional()
  })
  .passthrough()
  .transform((value) => ({
    ...value,
    uuid: value.uuid ?? value.id
  }));

export const onesOpenApiFieldOptionsResponseSchema = z
  .object({
    result: z.string().optional(),
    errorCode: z.string().optional(),
    error_code: z.string().optional(),
    errorMsg: z.string().optional(),
    error_msg: z.string().optional(),
    errorData: z.unknown().optional(),
    error_data: z.unknown().optional(),
    data: z.array(onesOpenApiFieldOptionItemSchema).default([])
  })
  .passthrough();

const onesOpenApiNamedItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1)
  })
  .passthrough();

export const onesOpenApiProjectSchema = onesOpenApiNamedItemSchema;

export const onesOpenApiIssueTypeSchema = onesOpenApiNamedItemSchema;

export const onesOpenApiIssueStatusSchema = onesOpenApiNamedItemSchema.extend({
  category: z.string().optional()
});

export const onesOpenApiUserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().optional(),
    staffID: z.string().optional()
  })
  .passthrough();

export const onesOpenApiIssueCommentOwnerSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional()
  })
  .passthrough();

export const onesOpenApiIssueCommentSchema = z
  .object({
    id: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    createTime: z.union([z.string(), z.number()]).optional(),
    create_time: z.union([z.string(), z.number()]).optional(),
    owner: onesOpenApiIssueCommentOwnerSchema.optional()
  })
  .passthrough();

export const onesOpenApiIssueAttachmentCreatorSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional()
  })
  .passthrough();

export const onesOpenApiIssueAttachmentSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    tempURL: z.string().optional(),
    temp_url: z.string().optional(),
    createTime: z.union([z.string(), z.number()]).optional(),
    create_time: z.union([z.string(), z.number()]).optional(),
    creator: onesOpenApiIssueAttachmentCreatorSchema.optional()
  })
  .passthrough();

export const onesOpenApiIssueWorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1)
});

function createOpenApiListEnvelopeSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      result: z.string().optional(),
      errorCode: z.string().optional(),
      errorMsg: z.string().optional(),
      errorData: z.unknown().optional(),
      data: z
        .object({
          list: z.array(itemSchema).default([]),
          pageInfo: onesOpenApiPageInfoSchema.optional(),
          page_info: onesOpenApiPageInfoSchema.optional()
        })
        .optional()
    })
    .passthrough();
}

export const onesOpenApiProjectsEnvelopeSchema = createOpenApiListEnvelopeSchema(
  onesOpenApiProjectSchema
);

export const onesOpenApiIssueTypesEnvelopeSchema =
  createOpenApiListEnvelopeSchema(onesOpenApiIssueTypeSchema);

export const onesOpenApiIssueStatusesEnvelopeSchema =
  createOpenApiListEnvelopeSchema(onesOpenApiIssueStatusSchema);

export const onesOpenApiUsersEnvelopeSchema =
  createOpenApiListEnvelopeSchema(onesOpenApiUserSchema);

export const onesOpenApiIssueCommentsEnvelopeSchema =
  z
    .object({
      result: z.string().optional(),
      errorCode: z.string().optional(),
      errorMsg: z.string().optional(),
      errorData: z.unknown().optional(),
      data: z
        .union([
          z.array(onesOpenApiIssueCommentSchema),
          z.object({
            list: z.array(onesOpenApiIssueCommentSchema).default([]),
            pageInfo: onesOpenApiPageInfoSchema.optional(),
            page_info: onesOpenApiPageInfoSchema.optional()
          })
        ])
        .optional(),
      pageInfo: onesOpenApiPageInfoSchema.optional(),
      page_info: onesOpenApiPageInfoSchema.optional()
    })
    .passthrough();

export const onesOpenApiIssueAttachmentsEnvelopeSchema =
  createOpenApiListEnvelopeSchema(onesOpenApiIssueAttachmentSchema);

export const onesOpenApiIssueWorkflowsEnvelopeSchema = z
  .object({
    result: z.string().optional(),
    errorCode: z.string().optional(),
    errorMsg: z.string().optional(),
    errorData: z.unknown().optional(),
    data: z.array(onesOpenApiIssueWorkflowSchema).default([])
  })
  .passthrough();

export const onesOpenApiOneSqlRowSchema = z
  .object({
    type: z.string().optional(),
    item: z.record(z.string(), z.unknown()).optional(),
    aggregate: z.record(z.string(), z.unknown()).optional(),
    group_aggregate: z.array(z.record(z.string(), z.unknown())).optional(),
    group: z
      .object({
        key: z.string().optional(),
        total: z.string().optional(),
        info: z.record(z.string(), z.unknown()).nullable().optional()
      })
      .optional()
  })
  .passthrough();

export const onesOpenApiOneSqlEnvelopeSchema = z
  .object({
    result: z.string().optional(),
    errorCode: z.string().optional(),
    errorMsg: z.string().optional(),
    errorData: z.unknown().optional(),
    data: z
      .object({
        data: z.array(onesOpenApiOneSqlRowSchema).default([]),
        pageInfo: onesOpenApiPageInfoSchema.optional(),
        page_info: onesOpenApiPageInfoSchema.optional()
      })
      .optional(),
    pageInfo: onesOpenApiPageInfoSchema.optional(),
    page_info: onesOpenApiPageInfoSchema.optional()
  })
  .passthrough();

const onesOpenApiFieldValueSchema = z.object({
  fieldID: z.string().min(1),
  type: z.number().int().positive().optional(),
  value: z.unknown().optional()
});

const onesOpenApiMutationIssueDataSchema = z.object({
  id: z.string().optional(),
  number: z.number().optional(),
  title: z.string().optional(),
  projectID: z.string().optional(),
  issueTypeID: z.string().optional(),
  parentID: z.string().optional()
});

export const onesOpenApiIssueDetailsEnvelopeSchema = z
  .object({
    result: z.string().optional(),
    errorCode: z.string().optional(),
    errorMsg: z.string().optional(),
    errorData: z.unknown().optional(),
    data: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        status: onesOpenApiIssueStatusSchema
      })
      .optional()
  })
  .passthrough();

const onesOpenApiBaseResponseSchema = z.object({
  result: z.string(),
  errorCode: z.string().optional(),
  errorMsg: z.string().optional(),
  errorData: z.record(z.string(), z.unknown()).optional()
});

export const onesOpenApiUpdateIssueRequestSchema = z.object({
  assignee: z.string().optional(),
  title: z.string().optional(),
  fieldValues: z.array(onesOpenApiFieldValueSchema).optional()
});

export const onesOpenApiCreateIssueRequestSchema = z.object({
  projectID: z.string().min(1),
  issueTypeID: z.string().min(1),
  title: z.string().min(1),
  assignee: z.string().min(1).optional(),
  watchers: z.array(z.string().min(1)).optional(),
  parentID: z.string().min(1).optional(),
  fieldValues: z.array(onesOpenApiFieldValueSchema).optional()
});

export const onesOpenApiCreateIssueResponseSchema =
  onesOpenApiBaseResponseSchema.extend({
    data: onesOpenApiMutationIssueDataSchema.optional()
  });

export const onesOpenApiUpdateIssueResponseSchema =
  onesOpenApiBaseResponseSchema.extend({
    data: onesOpenApiMutationIssueDataSchema.optional()
  });

export const onesOpenApiSendIssueCommentRequestSchema = z.object({
  text: z.string().min(1),
  repliedMessageID: z.string().min(1).optional()
});

export const onesOpenApiSendIssueCommentResponseSchema =
  onesOpenApiBaseResponseSchema.extend({
    data: z.unknown().optional()
  });

export const onesOpenApiUploadIssueAttachmentResponseSchema =
  onesOpenApiBaseResponseSchema.extend({
    data: z
      .object({
        id: z.string().min(1),
        name: z.string().optional()
      })
      .optional()
  });

export const onesOpenApiExecuteIssueWorkflowRequestSchema = z.object({
  id: z.string().min(1),
  fieldValues: z.array(onesOpenApiFieldValueSchema).optional()
});

export const onesOpenApiExecuteIssueWorkflowResponseSchema =
  onesOpenApiBaseResponseSchema;
