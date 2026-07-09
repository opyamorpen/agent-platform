import { z } from 'zod';
import { trimTrailingSlash } from '../shared/utils.js';

export const onesInternalApiConfigSchema = z.object({
  baseUrl: z
    .string()
    .url('ONES_BASE_URL must be a valid URL')
    .transform(trimTrailingSlash),
  teamId: z.string().optional().transform((value) => value?.trim()),
  authorization: z.string().min(1, 'Authorization header is required')
});

export const onesInternalPatchIssueFieldValueSchema = z
  .object({
    fieldUUID: z.string().min(1, 'fieldUUID is required'),
    value: z.unknown().optional(),
    append: z.array(z.unknown()).optional(),
    remove: z.array(z.unknown()).optional()
  })
  .refine(
    (value) =>
      value.value !== undefined ||
      value.append !== undefined ||
      value.remove !== undefined,
    {
      message: 'field patch requires value, append, or remove'
    }
  );

export const onesInternalPatchIssueRequestSchema = z.object({
  tasks: z.array(
    z.object({
      uuid: z.string().min(1),
      field_values: z.array(
        z.object({
          field_uuid: z.string().min(1),
          value: z.unknown().optional(),
          append: z.array(z.unknown()).optional(),
          remove: z.array(z.unknown()).optional()
        })
      )
    })
  )
});

export const onesInternalPatchIssueResponseSchema = z
  .object({
    bad_tasks: z.array(z.unknown()).optional(),
    async_compute_token: z.string().optional()
  })
  .passthrough();

export const onesInternalFieldListResponseSchema = z
  .object({
    fields: z.array(
      z
        .object({
          uuid: z.string().min(1),
          name: z.string(),
          type: z
            .object({
              uuid: z.string().optional(),
              name: z.string().optional(),
              value_type: z.string().optional(),
              valueType: z.string().optional(),
              reference_object_type: z.string().optional(),
              referenceObjectType: z.string().optional(),
              readonly: z.boolean().optional(),
              no_version: z.boolean().optional(),
              noVersion: z.boolean().optional()
            })
            .passthrough()
            .optional()
        })
        .passthrough()
    )
  })
  .passthrough();

export const onesInternalTokenInfoResponseSchema = z
  .object({
    user: z
      .object({
        uuid: z.string().min(1),
        email: z.string(),
        name: z.string(),
        language: z.string().optional()
      })
      .passthrough(),
    teams: z.array(
      z
        .object({
          uuid: z.string().min(1),
          name: z.string()
        })
        .passthrough()
    )
  })
  .passthrough();

export const onesInternalOrganizationPermissionsResponseSchema = z
  .object({
    org_evaluated_permissions: z
      .object({
        evaluated_permissions: z.array(
          z
            .object({
              key: z.string().min(1),
              context_type: z.string().min(1),
              context_param: z.string().nullable().optional(),
              permission: z.string().min(1)
            })
            .passthrough()
        ),
        server_update_stamp: z.union([z.string(), z.number()]).optional()
      })
      .passthrough()
  })
  .passthrough();

export const onesInternalTaskMessagesResponseSchema = z
  .object({
    messages: z.array(
      z
        .object({
          uuid: z.string().min(1),
          type: z.string().min(1),
          text: z.string().optional(),
          from_name: z.string().optional(),
          send_time: z.union([z.string(), z.number()]).optional(),
          rich_text: z.string().optional(),
          ext: z
            .object({
              message_status: z.string().optional(),
              rich_comment_uuid: z.string().optional(),
              update_time: z.union([z.string(), z.number()]).optional()
            })
            .passthrough()
            .optional()
        })
        .passthrough()
    ),
    count: z.number().optional(),
    has_next: z.boolean().optional()
  })
  .passthrough();
