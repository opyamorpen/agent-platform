import { OnesRequestError, OnesResponseError } from '../errors.js';
import { requestJson, requestRaw } from '../shared/http.js';
import type { OnesHttpRequest } from '../shared/http.js';
import type { OnesPageInfo } from '../types.js';
import {
  onesOpenApiConfigSchema,
  onesOpenApiCreateIssueRequestSchema,
  onesOpenApiCreateIssueResponseSchema,
  onesOpenApiExecuteIssueWorkflowRequestSchema,
  onesOpenApiExecuteIssueWorkflowResponseSchema,
  onesOpenApiFieldOptionsResponseSchema,
  onesOpenApiIssueAttachmentsEnvelopeSchema,
  onesOpenApiIssueDetailsEnvelopeSchema,
  onesOpenApiIssueCommentsEnvelopeSchema,
  onesOpenApiIssueWorkflowsEnvelopeSchema,
  onesOpenApiSendIssueCommentRequestSchema,
  onesOpenApiSendIssueCommentResponseSchema,
  onesOpenApiUploadIssueAttachmentResponseSchema,
  onesOpenApiUpdateIssueRequestSchema,
  onesOpenApiUpdateIssueResponseSchema,
  onesOpenApiIssueStatusesEnvelopeSchema,
  onesOpenApiIssueTypesEnvelopeSchema,
  onesOpenApiIssueFieldsEnvelopeSchema,
  onesOpenApiOneSqlEnvelopeSchema,
  onesOpenApiPageInfoSchema,
  onesOpenApiProjectsEnvelopeSchema,
  onesOpenApiUsersEnvelopeSchema,
  onesOpenApiWikiPageEnvelopeSchema,
  onesOpenApiWikiPageMutationSchema,
  onesOpenApiWikiPagesEnvelopeSchema,
  onesOpenApiWikiSpacesEnvelopeSchema
} from './schemas.js';
import type {
  OnesOpenApiClientOptions,
  OnesOpenApiConfig,
  OnesOpenApiCreateIssueRequest,
  OnesOpenApiExecuteOneSqlRequest,
  OnesOpenApiExecuteOneSqlResult,
  OnesOpenApiFieldOptionItem,
  OnesOpenApiFieldOptionQueryRequest,
  OnesOpenApiIssueAttachment,
  OnesOpenApiIssueComment,
  OnesOpenApiIssueField,
  OnesOpenApiIssueStatus,
  OnesOpenApiIssueType,
  OnesOpenApiListFieldOptionsResult,
  OnesOpenApiListIssueAttachmentsResult,
  OnesOpenApiListIssueCommentsResult,
  OnesOpenApiListIssueStatusesResult,
  OnesOpenApiListIssueFieldsRequest,
  OnesOpenApiListIssueFieldsResult,
  OnesOpenApiListIssueTypesResult,
  OnesOpenApiListProjectsResult,
  OnesOpenApiSearchUsersRequest,
  OnesOpenApiSearchUsersResult,
  OnesOpenApiProject,
  OnesOpenApiCursorRequest,
  OnesOpenApiExecuteIssueWorkflowRequest,
  OnesOpenApiIssueDetails,
  OnesOpenApiIssueWorkflow,
  OnesOpenApiMutationIssueData,
  OnesOpenApiResult,
  OnesOpenApiSendIssueCommentRequest,
  OnesOpenApiUploadIssueAttachmentRequest,
  OnesOpenApiUser,
  OnesOpenApiUpdateIssueRequest,
  OnesOpenApiAskWikiRequest,
  OnesOpenApiCopilotAnswer,
  OnesOpenApiCreateWikiPageRequest,
  OnesOpenApiUpdateWikiPageRequest,
  OnesOpenApiWikiPage,
  OnesOpenApiWikiReference,
  OnesOpenApiWikiSpace
} from './types.js';

function flattenWikiPages(value: unknown): OnesOpenApiWikiPage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const pages: OnesOpenApiWikiPage[] = [];
  const queue = [...value];

  while (queue.length > 0) {
    const candidate = queue.shift();
    const parsed =
      onesOpenApiWikiPageEnvelopeSchema.shape.data.safeParse(candidate);

    if (!parsed.success || !parsed.data) {
      continue;
    }

    pages.push(parsed.data);

    if (candidate && typeof candidate === 'object') {
      const children = (candidate as { children?: unknown }).children;
      if (Array.isArray(children)) {
        queue.push(...children);
      }
    }
  }

  return pages;
}

function parseCopilotSse(text: string): OnesOpenApiCopilotAnswer {
  let answer: OnesOpenApiCopilotAnswer | null = null;

  for (const block of text.split(/\r?\n\r?\n/u)) {
    const data = block
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    if (!data || data === '[DONE]') {
      continue;
    }

    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    if (!event || typeof event !== 'object') {
      continue;
    }

    const record = event as Record<string, unknown>;
    if (record.type === 'error' || record.errorCode || record.code) {
      throw new OnesResponseError(
        `ONES Copilot failed: ${String(record.errorMsg ?? record.message ?? 'unknown error')}`,
        String(record.errorCode ?? record.code ?? 'COPILOT_ERROR')
      );
    }

    if (record.type === 'generationEnd') {
      const references = Array.isArray(record.references)
        ? record.references.flatMap((reference): OnesOpenApiWikiReference[] => {
            if (!reference || typeof reference !== 'object') {
              return [];
            }

            const item = reference as Record<string, unknown>;
            if (
              (item.contentType !== 'page' &&
                item.contentType !== 'media' &&
                item.contentType !== 'attachment') ||
              typeof item.itemID !== 'string'
            ) {
              return [];
            }

            return [
              {
                contentType: item.contentType,
                itemID: item.itemID,
                fileName:
                  typeof item.fileName === 'string' ? item.fileName : undefined
              }
            ];
          })
        : [];

      answer = {
        content: typeof record.content === 'string' ? record.content : '',
        references
      };
    }
  }

  if (!answer) {
    throw new OnesResponseError(
      'ONES Copilot response did not include generationEnd',
      'COPILOT_INVALID_RESPONSE'
    );
  }

  return answer;
}

function normalizePageInfo(
  payload: unknown,
  fallbackCount: number
): OnesPageInfo {
  const parsedPageInfo = onesOpenApiPageInfoSchema.safeParse(payload);

  if (!parsedPageInfo.success) {
    return {
      hasNextPage: false,
      count: fallbackCount,
      totalCount: fallbackCount
    };
  }

  return {
    hasNextPage:
      parsedPageInfo.data.hasNextPage ??
      parsedPageInfo.data.has_next_page ??
      false,
    startCursor:
      parsedPageInfo.data.startCursor ?? parsedPageInfo.data.start_cursor,
    endCursor: parsedPageInfo.data.endCursor ?? parsedPageInfo.data.end_cursor,
    totalCount:
      parsedPageInfo.data.totalCount ??
      parsedPageInfo.data.total_count ??
      fallbackCount,
    count: parsedPageInfo.data.count ?? fallbackCount
  };
}

function assertOpenApiSuccess(
  result: string | undefined,
  errorCode: string | undefined,
  errorMsg: string | undefined,
  errorData: unknown,
  action: string
) {
  if (!result || result.toLowerCase() === 'success') {
    return;
  }

  throw new OnesResponseError(
    `ONES OpenAPI ${action} failed: ${errorMsg ?? result}`,
    errorCode,
    errorData
  );
}

function normalizeIssueField(field: {
  id?: string;
  uuid?: string;
  name?: string;
  fieldType?: string;
  field_type?: string;
  valueType?: string;
  value_type?: string;
  valueTypeDesc?: string;
  value_type_desc?: string;
  builtIn?: boolean;
  built_in?: boolean;
  options?: Array<{ id?: string; value?: string; name?: string }>;
}): OnesOpenApiIssueField {
  const uuid = field.uuid ?? field.id;

  if (!uuid || !field.name) {
    throw new OnesResponseError(
      `ONES OpenAPI returned invalid issue field payload: ${JSON.stringify(field)}`
    );
  }

  return {
    id: field.id ?? uuid,
    uuid,
    name: field.name,
    fieldType: field.fieldType ?? field.field_type,
    valueType:
      field.valueType ??
      field.value_type ??
      field.valueTypeDesc ??
      field.value_type_desc,
    builtIn: field.builtIn ?? field.built_in,
    options:
      field.options?.flatMap((option) => {
        const id = option.id ?? option.value;

        if (!id) {
          return [];
        }

        return [
          {
            id,
            value: option.value ?? option.name
          }
        ];
      }) ?? []
  };
}

function normalizeNamedItem<T extends { id: string; name: string }>(item: T) {
  return {
    id: item.id,
    name: item.name
  };
}

function normalizeUser(user: {
  id: string;
  name: string;
  email?: string;
  staffID?: string;
}): OnesOpenApiUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    staffID: user.staffID
  };
}

function normalizeIssueComment(comment: {
  id?: string;
  text?: string;
  content?: string;
  createTime?: string | number;
  create_time?: string | number;
  owner?: {
    id?: string;
    name?: string;
  };
}): OnesOpenApiIssueComment {
  if (!comment.id) {
    throw new OnesResponseError(
      `ONES OpenAPI returned invalid issue comment payload: ${JSON.stringify(comment)}`
    );
  }

  return {
    id: comment.id,
    text: comment.text ?? comment.content ?? '',
    createTime:
      typeof comment.createTime === 'number'
        ? String(comment.createTime)
        : typeof comment.create_time === 'number'
          ? String(comment.create_time)
          : (comment.createTime ?? comment.create_time),
    owner: comment.owner
  };
}

function normalizeIssueAttachment(attachment: {
  id?: string;
  name?: string;
  tempURL?: string;
  temp_url?: string;
  createTime?: string | number;
  create_time?: string | number;
  creator?: {
    id?: string;
    name?: string;
  };
}): OnesOpenApiIssueAttachment {
  if (!attachment.id || !attachment.name) {
    throw new OnesResponseError(
      `ONES OpenAPI returned invalid issue attachment payload: ${JSON.stringify(attachment)}`
    );
  }

  return {
    id: attachment.id,
    name: attachment.name,
    tempURL: attachment.tempURL ?? attachment.temp_url ?? '',
    createTime:
      typeof attachment.createTime === 'number'
        ? String(attachment.createTime)
        : typeof attachment.create_time === 'number'
          ? String(attachment.create_time)
          : (attachment.createTime ?? attachment.create_time),
    creator: attachment.creator
  };
}

export class OnesOpenApiClient {
  constructor(private readonly options: OnesOpenApiClientOptions) {}

  private async getConfig(forceRefresh = false): Promise<OnesOpenApiConfig> {
    if (forceRefresh && this.options.resolveConfig) {
      return onesOpenApiConfigSchema.parse(
        await this.options.resolveConfig({ forceRefresh: true })
      ) as OnesOpenApiConfig;
    }

    return onesOpenApiConfigSchema.parse(this.options) as OnesOpenApiConfig;
  }

  private isNotActiveRequestError(error: unknown): error is OnesRequestError {
    if (!(error instanceof OnesRequestError) || error.status !== 401) {
      return false;
    }

    if (!error.responseBody) {
      return false;
    }

    try {
      const payload = JSON.parse(error.responseBody) as {
        errorCode?: string;
        errorMsg?: string;
      };

      return (
        payload.errorCode === 'NotActive' ||
        payload.errorMsg?.toLowerCase().includes('not active') === true
      );
    } catch {
      return error.responseBody.toLowerCase().includes('not active');
    }
  }

  private async requestJson(
    buildRequest: (config: OnesOpenApiConfig) => OnesHttpRequest
  ): Promise<unknown> {
    const config = await this.getConfig();

    try {
      return await requestJson(buildRequest(config));
    } catch (error) {
      if (!this.options.resolveConfig || !this.isNotActiveRequestError(error)) {
        throw error;
      }

      const refreshedConfig = await this.getConfig(true);
      return await requestJson(buildRequest(refreshedConfig));
    }
  }

  private async requestRaw(
    buildRequest: (config: OnesOpenApiConfig) => OnesHttpRequest
  ): Promise<Response> {
    const config = await this.getConfig();

    try {
      return await requestRaw(buildRequest(config));
    } catch (error) {
      if (!this.options.resolveConfig || !this.isNotActiveRequestError(error)) {
        throw error;
      }

      const refreshedConfig = await this.getConfig(true);
      return requestRaw(buildRequest(refreshedConfig));
    }
  }

  async executeOneSQL(
    request: string | OnesOpenApiExecuteOneSqlRequest
  ): Promise<OnesOpenApiExecuteOneSqlResult> {
    const normalizedRequest =
      typeof request === 'string' ? { query: request } : request;

    const payload = onesOpenApiOneSqlEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v3alpha/onesql/query',
        method: 'POST',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: {
          query: normalizedRequest.query,
          variables: normalizedRequest.variables ?? [],
          hierarchy: normalizedRequest.hierarchy
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'executeOneSQL'
    );

    const rows = payload.data?.data ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ??
        payload.data?.page_info ??
        payload.pageInfo ??
        payload.page_info,
      rows.length
    );

    return {
      rows: rows.map((row) => ({
        type: row.type,
        item: row.item,
        aggregate: row.aggregate,
        groupAggregate: row.group_aggregate,
        group: row.group
          ? {
              key: row.group.key,
              total: row.group.total,
              info: row.group.info
            }
          : undefined
      })),
      pageInfo
    };
  }

  async createIssue(
    request: OnesOpenApiCreateIssueRequest
  ): Promise<OnesOpenApiResult<OnesOpenApiMutationIssueData>> {
    const parsedRequest = onesOpenApiCreateIssueRequestSchema.parse({
      projectID: request.projectID,
      issueTypeID: request.issueTypeID,
      title: request.title,
      assignee: request.assignee,
      watchers: request.watchers?.map((watcher) => watcher),
      parentID: request.parentID,
      fieldValues: request.fieldValues?.map((fieldValue) => ({
        ...fieldValue
      }))
    });
    const payload = onesOpenApiCreateIssueResponseSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/project/issues',
        method: 'POST',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: parsedRequest
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'createIssue'
    );

    return {
      result: payload.result,
      errorCode: payload.errorCode,
      errorMsg: payload.errorMsg,
      errorData: payload.errorData,
      data: payload.data
    };
  }

  async updateIssue(
    issueUUID: string,
    request: OnesOpenApiUpdateIssueRequest
  ): Promise<OnesOpenApiResult<OnesOpenApiMutationIssueData>> {
    const parsedIssueUUID = issueUUID.trim();
    const parsedRequest = onesOpenApiUpdateIssueRequestSchema.parse({
      assignee: request.assignee,
      title: request.title,
      fieldValues: request.fieldValues?.map((fieldValue) => ({
        ...fieldValue
      }))
    });
    const payload = onesOpenApiUpdateIssueResponseSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}`,
        method: 'PUT',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: parsedRequest
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'updateIssue'
    );

    return {
      result: payload.result,
      errorCode: payload.errorCode,
      errorMsg: payload.errorMsg,
      errorData: payload.errorData,
      data: payload.data
    };
  }

  async getIssue(issueUUID: string): Promise<OnesOpenApiIssueDetails> {
    const parsedIssueUUID = issueUUID.trim();
    const payload = onesOpenApiIssueDetailsEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}`,
        method: 'GET',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'getIssue'
    );

    if (!payload.data) {
      throw new OnesResponseError(
        `ONES OpenAPI getIssue failed: missing data for ${parsedIssueUUID}`
      );
    }

    return {
      id: payload.data.id,
      name: payload.data.name ?? payload.data.title ?? '',
      status: payload.data.status
    };
  }

  async listExecutableIssueWorkflows(
    issueUUID: string
  ): Promise<OnesOpenApiIssueWorkflow[]> {
    const parsedIssueUUID = issueUUID.trim();
    const payload = onesOpenApiIssueWorkflowsEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}`,
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          action: 'executableWorkflow'
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listExecutableIssueWorkflows'
    );

    return payload.data;
  }

  async listIssueComments(
    issueUUID: string,
    request: OnesOpenApiCursorRequest = {}
  ): Promise<OnesOpenApiListIssueCommentsResult> {
    const parsedIssueUUID = issueUUID.trim();
    const payload = onesOpenApiIssueCommentsEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}/comments`,
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listIssueComments'
    );

    const list = Array.isArray(payload.data)
      ? payload.data
      : (payload.data?.list ?? []);
    const pageInfo = normalizePageInfo(
      Array.isArray(payload.data)
        ? (payload.pageInfo ?? payload.page_info)
        : (payload.data?.pageInfo ??
            payload.data?.page_info ??
            payload.pageInfo ??
            payload.page_info),
      list.length
    );

    return {
      list: list.map((comment) => normalizeIssueComment(comment)),
      pageInfo
    };
  }

  async sendIssueComment(
    issueUUID: string,
    request: OnesOpenApiSendIssueCommentRequest
  ): Promise<OnesOpenApiResult> {
    const parsedIssueUUID = issueUUID.trim();
    const parsedRequest = onesOpenApiSendIssueCommentRequestSchema.parse({
      text: request.text,
      repliedMessageID: request.repliedMessageID
    });
    const payload = onesOpenApiSendIssueCommentResponseSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}/comments`,
        method: 'POST',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: parsedRequest
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'sendIssueComment'
    );

    return {
      result: payload.result,
      errorCode: payload.errorCode,
      errorMsg: payload.errorMsg,
      errorData: payload.errorData,
      data: undefined
    };
  }

  async uploadIssueAttachment(
    issueUUID: string,
    request: OnesOpenApiUploadIssueAttachmentRequest
  ): Promise<string> {
    const parsedIssueUUID = issueUUID.trim();
    const formData = new FormData();
    formData.append('name', request.fileName);
    formData.append('file', request.file, request.fileName);

    const payload = onesOpenApiUploadIssueAttachmentResponseSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}/attachments`,
        method: 'POST',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: formData
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'uploadIssueAttachment'
    );

    if (!payload.data?.id) {
      throw new OnesResponseError(
        `ONES OpenAPI uploadIssueAttachment failed: missing attachment id for ${parsedIssueUUID}`
      );
    }

    return payload.data.id;
  }

  async listIssueAttachments(
    issueUUID: string,
    request: OnesOpenApiCursorRequest = {}
  ): Promise<OnesOpenApiListIssueAttachmentsResult> {
    const parsedIssueUUID = issueUUID.trim();
    const payload = onesOpenApiIssueAttachmentsEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}/attachments`,
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listIssueAttachments'
    );

    const list = payload.data?.list ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ?? payload.data?.page_info,
      list.length
    );

    return {
      list: list.map((attachment) => normalizeIssueAttachment(attachment)),
      pageInfo
    };
  }

  async executeIssueWorkflow(
    issueUUID: string,
    request: OnesOpenApiExecuteIssueWorkflowRequest
  ): Promise<void> {
    const parsedIssueUUID = issueUUID.trim();
    const parsedRequest = onesOpenApiExecuteIssueWorkflowRequestSchema.parse({
      id: request.id,
      fieldValues: request.fieldValues?.map((fieldValue) => ({
        ...fieldValue
      }))
    });
    const payload = onesOpenApiExecuteIssueWorkflowResponseSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/project/issues/${encodeURIComponent(parsedIssueUUID)}`,
        method: 'POST',
        searchParams: {
          teamID: config.teamId,
          action: 'executeWorkflow'
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: parsedRequest
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'executeIssueWorkflow'
    );
  }

  async listIssueFields(
    request: OnesOpenApiListIssueFieldsRequest = {}
  ): Promise<OnesOpenApiListIssueFieldsResult> {
    const payload = onesOpenApiIssueFieldsEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/project/issueFields',
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listIssueFields'
    );

    const list = payload.data?.list ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ?? payload.data?.page_info,
      list.length
    );

    return {
      list: list.map((field) => normalizeIssueField(field)),
      pageInfo
    };
  }

  async listFieldOptions(
    request: OnesOpenApiFieldOptionQueryRequest
  ): Promise<OnesOpenApiListFieldOptionsResult> {
    const parsedFieldUUID = request.fieldUUID.trim();

    if (!parsedFieldUUID) {
      throw new OnesResponseError(
        'ONES OpenAPI listFieldOptions failed: fieldUUID is required'
      );
    }

    const payload = onesOpenApiFieldOptionsResponseSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v3alpha/field/options',
        method: 'POST',
        searchParams: {
          teamID: config.teamId
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: {
          field_uuid: parsedFieldUUID,
          uuids: request.uuids?.map((uuid) => uuid.trim()).filter(Boolean),
          include_fields: request.includeFields
            ?.map((field) => field.trim())
            .filter(Boolean),
          keyword: request.keyword?.trim(),
          limit: request.limit,
          offset: request.offset
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode ?? payload.error_code,
      payload.errorMsg ?? payload.error_msg,
      payload.errorData ?? payload.error_data,
      'listFieldOptions'
    );

    return {
      list: payload.data.map((item): OnesOpenApiFieldOptionItem => {
        if (!item.uuid) {
          throw new OnesResponseError(
            `ONES OpenAPI listFieldOptions failed: invalid option payload ${JSON.stringify(item)}`
          );
        }

        return {
          ...item,
          uuid: item.uuid
        };
      })
    };
  }

  async listProjects(
    request: OnesOpenApiCursorRequest = {}
  ): Promise<OnesOpenApiListProjectsResult> {
    const payload = onesOpenApiProjectsEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/project/projects',
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listProjects'
    );

    const list = payload.data?.list ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ?? payload.data?.page_info,
      list.length
    );

    return {
      list: list.map(
        (project): OnesOpenApiProject => normalizeNamedItem(project)
      ),
      pageInfo
    };
  }

  async listIssueTypes(
    request: OnesOpenApiCursorRequest = {}
  ): Promise<OnesOpenApiListIssueTypesResult> {
    const payload = onesOpenApiIssueTypesEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/project/issueTypes',
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listIssueTypes'
    );

    const list = payload.data?.list ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ?? payload.data?.page_info,
      list.length
    );

    return {
      list: list.map(
        (issueType): OnesOpenApiIssueType => normalizeNamedItem(issueType)
      ),
      pageInfo
    };
  }

  async listIssueStatuses(
    request: OnesOpenApiCursorRequest = {}
  ): Promise<OnesOpenApiListIssueStatusesResult> {
    const payload = onesOpenApiIssueStatusesEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/project/issueStatuses',
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listIssueStatuses'
    );

    const list = payload.data?.list ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ?? payload.data?.page_info,
      list.length
    );

    return {
      list: list.map(
        (issueStatus): OnesOpenApiIssueStatus => ({
          ...normalizeNamedItem(issueStatus),
          category: issueStatus.category
        })
      ),
      pageInfo
    };
  }

  async searchUsers(
    request: OnesOpenApiSearchUsersRequest = {}
  ): Promise<OnesOpenApiSearchUsersResult> {
    const payload = onesOpenApiUsersEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/account/users/search',
        method: 'GET',
        searchParams: {
          teamID: config.teamId,
          keyword: request.keyword,
          limit: request.limit,
          cursor: request.cursor
        },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'searchUsers'
    );

    const list = payload.data?.list ?? [];
    const pageInfo = normalizePageInfo(
      payload.data?.pageInfo ?? payload.data?.page_info,
      list.length
    );

    return {
      list: list.map((user): OnesOpenApiUser => normalizeUser(user)),
      pageInfo
    };
  }

  async listWikiSpaces(): Promise<OnesOpenApiWikiSpace[]> {
    const payload = onesOpenApiWikiSpacesEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/wiki/spaces',
        searchParams: { teamID: config.teamId },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listWikiSpaces'
    );

    return payload.data?.spaces ?? [];
  }

  async listWikiPages(spaceID: string): Promise<OnesOpenApiWikiPage[]> {
    const payload = onesOpenApiWikiPagesEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/wiki/spaces/${encodeURIComponent(spaceID)}/pages`,
        searchParams: { teamID: config.teamId, archived: false },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'listWikiPages'
    );

    const data = payload.data;
    return flattenWikiPages(Array.isArray(data) ? data : (data?.pages ?? []));
  }

  async getWikiPage(pageID: string): Promise<OnesOpenApiWikiPage> {
    const payload = onesOpenApiWikiPageEnvelopeSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: `/openapi/v2/wiki/pages/${encodeURIComponent(pageID)}`,
        searchParams: { teamID: config.teamId },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        }
      }))
    );

    assertOpenApiSuccess(
      payload.result,
      payload.errorCode,
      payload.errorMsg,
      payload.errorData,
      'getWikiPage'
    );

    if (!payload.data) {
      throw new OnesResponseError(
        `Wiki page not found: ${pageID}`,
        'WIKI_PAGE_NOT_FOUND'
      );
    }

    return payload.data as OnesOpenApiWikiPage;
  }

  async askWiki(
    request: OnesOpenApiAskWikiRequest
  ): Promise<OnesOpenApiCopilotAnswer> {
    const response = await this.requestRaw((config) => ({
      baseUrl: config.baseUrl,
      path: '/openapi/v2/wiki/ask',
      method: 'POST',
      searchParams: { teamID: config.teamId },
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${config.accessToken}`
      },
      body: {
        scopeType: request.scopeType,
        scopeID: request.scopeID,
        query: request.query,
        language: request.language,
        generateRelatedQuestions: false,
        config: {
          expandQuery: request.expandQuery ?? true,
          enableCache: request.enableCache ?? true
        }
      },
      signal: request.signal
    }));

    return parseCopilotSse(await response.text());
  }

  async createWikiPage(
    request: OnesOpenApiCreateWikiPageRequest
  ): Promise<OnesOpenApiWikiPage> {
    const formData = new FormData();
    formData.append('parentPageID', request.parentPageID);
    formData.append('title', request.title);
    formData.append('content', request.content);

    const payload = onesOpenApiWikiPageMutationSchema.parse(
      await this.requestJson((config) => ({
        baseUrl: config.baseUrl,
        path: '/openapi/v2/wiki/pages',
        method: 'POST',
        searchParams: { teamID: config.teamId },
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: formData
      }))
    );

    if (!payload.data) {
      throw new OnesResponseError('Create Wiki page returned no page data');
    }

    return payload.data as OnesOpenApiWikiPage;
  }

  async updateWikiPage(
    pageID: string,
    request: OnesOpenApiUpdateWikiPageRequest
  ): Promise<void> {
    const payload = await this.requestJson((config) => ({
      baseUrl: config.baseUrl,
      path: `/openapi/v2/wiki/pages/${encodeURIComponent(pageID)}`,
      method: 'POST',
      searchParams: { teamID: config.teamId },
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.accessToken}`
      },
      body: request
    }));

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      assertOpenApiSuccess(
        typeof record.result === 'string' ? record.result : undefined,
        typeof record.errorCode === 'string' ? record.errorCode : undefined,
        typeof record.errorMsg === 'string' ? record.errorMsg : undefined,
        record.errorData,
        'updateWikiPage'
      );
    }
  }
}
