export interface OnesInternalApiClientOptions {
  baseUrl: string;
  teamId?: string;
  authorization: string;
}

export interface OnesInternalApiConfig {
  baseUrl: string;
  teamId?: string;
  authorization: string;
}

export interface OnesInternalPatchIssueFieldValue {
  fieldUUID: string;
  value?: unknown;
  append?: unknown[];
  remove?: unknown[];
}

export interface OnesInternalFieldType {
  uuid?: string;
  name?: string;
  valueType?: string;
  value_type?: string;
  referenceObjectType?: string;
  reference_object_type?: string;
  readonly?: boolean;
  noVersion?: boolean;
  no_version?: boolean;
}

export interface OnesInternalField {
  uuid: string;
  name: string;
  type?: OnesInternalFieldType;
}

export interface OnesInternalTokenInfoUser {
  uuid: string;
  email: string;
  name: string;
  language?: string;
}

export interface OnesInternalTokenInfoTeam {
  uuid: string;
  name: string;
}

export interface OnesInternalTokenInfo {
  user: OnesInternalTokenInfoUser;
  teams: OnesInternalTokenInfoTeam[];
}

export interface OnesInternalEvaluatedPermission {
  key: string;
  contextType: string;
  contextParam: string | null;
  permission: string;
}

export interface OnesInternalOrganizationPermissions {
  evaluatedPermissions: OnesInternalEvaluatedPermission[];
  serverUpdateStamp?: string;
}

export interface OnesInternalTaskMessageExt {
  messageStatus?: string;
  richCommentUUID?: string;
  updateTime?: string;
}

export interface OnesInternalTaskMessage {
  uuid: string;
  type: string;
  text: string;
  fromName?: string;
  sendTime?: string;
  richText?: string;
  ext?: OnesInternalTaskMessageExt;
}

export interface OnesInternalListTaskMessagesResult {
  messages: OnesInternalTaskMessage[];
  count?: number;
  hasNext?: boolean;
}
