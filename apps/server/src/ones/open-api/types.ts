import type { OnesOneSqlRow, OnesPageInfo } from '../types.js';

export interface OnesOpenApiClientOptions {
  baseUrl: string;
  teamId: string;
  accessToken: string;
  resolveConfig?: (options?: {
    forceRefresh?: boolean;
  }) => Promise<OnesOpenApiConfig>;
}

export interface OnesOpenApiConfig {
  baseUrl: string;
  teamId: string;
  accessToken: string;
}

export interface OnesOpenApiIssueFieldOption {
  id: string;
  value?: string;
}

export interface OnesOpenApiFieldOptionQueryRequest {
  fieldUUID: string;
  uuids?: string[];
  includeFields?: string[];
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface OnesOpenApiFieldOptionItem {
  uuid: string;
  [key: string]: unknown;
}

export interface OnesOpenApiIssueField {
  id: string;
  uuid: string;
  name: string;
  fieldType?: string;
  valueType?: string;
  builtIn?: boolean;
  options: OnesOpenApiIssueFieldOption[];
}

export interface OnesOpenApiListIssueFieldsRequest {
  limit?: number;
  cursor?: string;
}

export interface OnesOpenApiListIssueFieldsResult {
  list: OnesOpenApiIssueField[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiListFieldOptionsResult {
  list: OnesOpenApiFieldOptionItem[];
}

export interface OnesOpenApiProject {
  id: string;
  name: string;
}

export interface OnesOpenApiIssueType {
  id: string;
  name: string;
}

export interface OnesOpenApiIssueStatus {
  id: string;
  name: string;
  category?: string;
}

export interface OnesOpenApiUser {
  id: string;
  name: string;
  email?: string;
  staffID?: string;
}

export interface OnesOpenApiIssueWorkflow {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface OnesOpenApiCursorRequest {
  limit?: number;
  cursor?: string;
}

export interface OnesOpenApiListProjectsResult {
  list: OnesOpenApiProject[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiListIssueTypesResult {
  list: OnesOpenApiIssueType[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiListIssueStatusesResult {
  list: OnesOpenApiIssueStatus[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiSearchUsersRequest extends OnesOpenApiCursorRequest {
  keyword?: string;
}

export interface OnesOpenApiSearchUsersResult {
  list: OnesOpenApiUser[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiIssueDetails {
  id: string;
  name: string;
  status: OnesOpenApiIssueStatus;
}

export interface OnesOpenApiIssueCommentOwner {
  id?: string;
  name?: string;
}

export interface OnesOpenApiIssueAttachmentCreator {
  id?: string;
  name?: string;
}

export interface OnesOpenApiIssueAttachment {
  id: string;
  name: string;
  tempURL: string;
  createTime?: string;
  creator?: OnesOpenApiIssueAttachmentCreator;
}

export interface OnesOpenApiIssueComment {
  id: string;
  text: string;
  createTime?: string;
  owner?: OnesOpenApiIssueCommentOwner;
}

export interface OnesOpenApiListIssueAttachmentsResult {
  list: OnesOpenApiIssueAttachment[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiListIssueCommentsResult {
  list: OnesOpenApiIssueComment[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiExecuteOneSqlRequest {
  query: string;
  variables?: unknown[];
  hierarchy?: Record<string, unknown>;
}

export interface OnesOpenApiExecuteOneSqlResult {
  rows: OnesOneSqlRow[];
  pageInfo: OnesPageInfo;
}

export interface OnesOpenApiFieldValue {
  fieldID: string;
  type?: number;
  value?: unknown;
}

export interface OnesOpenApiMutationIssueData {
  id?: string;
  number?: number;
  title?: string;
  projectID?: string;
  issueTypeID?: string;
  parentID?: string;
}

export interface OnesOpenApiResult<TData = undefined> {
  result: string;
  errorCode?: string;
  errorMsg?: string;
  errorData?: Record<string, unknown>;
  data?: TData;
}

export interface OnesOpenApiUpdateIssueRequest {
  assignee?: string;
  title?: string;
  fieldValues?: readonly OnesOpenApiFieldValue[];
}

export interface OnesOpenApiCreateIssueRequest {
  projectID: string;
  issueTypeID: string;
  title: string;
  assignee?: string;
  watchers?: readonly string[];
  parentID?: string;
  fieldValues?: readonly OnesOpenApiFieldValue[];
}

export interface OnesOpenApiUploadIssueAttachmentRequest {
  fileName: string;
  file: Blob;
}

export interface OnesOpenApiSendIssueCommentRequest {
  text: string;
  repliedMessageID?: string;
}

export interface OnesOpenApiExecuteIssueWorkflowRequest {
  id: string;
  fieldValues?: readonly OnesOpenApiFieldValue[];
}
