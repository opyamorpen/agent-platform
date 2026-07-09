import {
  OnesConfigError,
  OnesResponseError
} from '../errors.js';
import { requestJson } from '../shared/http.js';
import {
  onesInternalApiConfigSchema,
  onesInternalFieldListResponseSchema,
  onesInternalOrganizationPermissionsResponseSchema,
  onesInternalPatchIssueFieldValueSchema,
  onesInternalPatchIssueRequestSchema,
  onesInternalPatchIssueResponseSchema,
  onesInternalTokenInfoResponseSchema,
  onesInternalTaskMessagesResponseSchema
} from './schemas.js';
import type {
  OnesInternalApiClientOptions,
  OnesInternalApiConfig,
  OnesInternalOrganizationPermissions,
  OnesInternalField,
  OnesInternalTokenInfo,
  OnesInternalListTaskMessagesResult,
  OnesInternalTaskMessage,
  OnesInternalPatchIssueFieldValue
} from './types.js';

function normalizeTaskMessage(message: {
  uuid: string;
  type: string;
  text?: string;
  from_name?: string;
  send_time?: string | number;
  rich_text?: string;
  ext?: {
    message_status?: string;
    rich_comment_uuid?: string;
    update_time?: string | number;
  };
}): OnesInternalTaskMessage {
  return {
    uuid: message.uuid,
    type: message.type,
    text: message.text ?? '',
    fromName: message.from_name,
    sendTime:
      typeof message.send_time === 'number'
        ? String(message.send_time)
        : message.send_time,
    richText: message.rich_text,
    ext: message.ext
      ? {
          messageStatus: message.ext.message_status,
          richCommentUUID: message.ext.rich_comment_uuid,
          updateTime:
            typeof message.ext.update_time === 'number'
              ? String(message.ext.update_time)
              : message.ext.update_time
        }
      : undefined
  };
}

export class OnesInternalApiClient {
  constructor(private readonly options: OnesInternalApiClientOptions) {}

  private getRequiredTeamId(config: OnesInternalApiConfig): string {
    const teamId = config.teamId?.trim();

    if (!teamId) {
      throw new OnesConfigError('team_uuid request header is required');
    }

    return teamId;
  }

  async get(
    path: string,
    searchParams?: Record<string, string | number | boolean | null | undefined>
  ): Promise<unknown> {
    return this.requestWithSession(path, {
      method: 'GET',
      searchParams
    });
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.requestWithSession(path, {
      method: 'POST',
      body
    });
  }

  async put(path: string, body?: unknown): Promise<unknown> {
    return this.requestWithSession(path, {
      method: 'PUT',
      body
    });
  }

  async patch(path: string, body?: unknown): Promise<unknown> {
    return this.requestWithSession(path, {
      method: 'PATCH',
      body
    });
  }

  async listFields(): Promise<OnesInternalField[]> {
    const config = await this.getConfig();
    const teamId = this.getRequiredTeamId(config);
    const payload = onesInternalFieldListResponseSchema.parse(
      await this.get(
        `/project/api/ones-project/team/${encodeURIComponent(teamId)}/v2/field/list`
      )
    );

    return payload.fields.map((field) => ({
      uuid: field.uuid,
      name: field.name,
      type: field.type
        ? {
            uuid: field.type.uuid,
            name: field.type.name,
            valueType: field.type.valueType ?? field.type.value_type,
            referenceObjectType:
              field.type.referenceObjectType ?? field.type.reference_object_type,
            readonly: field.type.readonly,
            noVersion: field.type.noVersion ?? field.type.no_version
          }
        : undefined
    }));
  }

  async getTokenInfo(): Promise<OnesInternalTokenInfo> {
    const payload = onesInternalTokenInfoResponseSchema.parse(
      await this.get('/project/api/project/auth/token_info')
    );

    return {
      user: {
        uuid: payload.user.uuid,
        email: payload.user.email,
        name: payload.user.name,
        language: payload.user.language
      },
      teams: payload.teams.map((team) => ({
        uuid: team.uuid,
        name: team.name
      }))
    };
  }

  async getOrganizationPermissions(
    organizationUUID: string
  ): Promise<OnesInternalOrganizationPermissions> {
    const parsedOrganizationUUID = organizationUUID.trim();
    const payload = onesInternalOrganizationPermissionsResponseSchema.parse(
      await this.post(
        `/project/api/project/organization/${encodeURIComponent(parsedOrganizationUUID)}/stamps/data?t=org_evaluated_permissions`,
        {
          org_evaluated_permissions: 0
        }
      )
    );

    return {
      evaluatedPermissions:
        payload.org_evaluated_permissions.evaluated_permissions.map((permission) => ({
          key: permission.key,
          contextType: permission.context_type,
          contextParam: permission.context_param ?? null,
          permission: permission.permission
        })),
      serverUpdateStamp:
        payload.org_evaluated_permissions.server_update_stamp !== undefined
          ? String(payload.org_evaluated_permissions.server_update_stamp)
          : undefined
    };
  }

  async patchIssueFields(
    issueUUID: string,
    fieldValues: readonly OnesInternalPatchIssueFieldValue[]
  ): Promise<void> {
    const config = await this.getConfig();
    const teamId = this.getRequiredTeamId(config);
    const parsedIssueUUID = issueUUID.trim();
    const parsedFieldValues = fieldValues.map((fieldValue) =>
      onesInternalPatchIssueFieldValueSchema.parse(fieldValue)
    );
    const requestBody = onesInternalPatchIssueRequestSchema.parse({
      tasks: [
        {
          uuid: parsedIssueUUID,
          field_values: parsedFieldValues.map((fieldValue) => ({
            field_uuid: fieldValue.fieldUUID,
            value: fieldValue.value,
            append: fieldValue.append,
            remove: fieldValue.remove
          }))
        }
      ]
    });

    const payload = onesInternalPatchIssueResponseSchema.parse(
      await this.post(
        `/team/${encodeURIComponent(teamId)}/tasks/update3`,
        requestBody
      )
    );

    if ((payload.bad_tasks?.length ?? 0) > 0) {
      throw new OnesResponseError(
        `ONES internal patch issue failed: ${JSON.stringify(payload.bad_tasks)}`,
        undefined,
        payload.bad_tasks
      );
    }
  }

  async listTaskMessages(
    issueUUID: string,
    options: {
      limit?: number;
    } = {}
  ): Promise<OnesInternalListTaskMessagesResult> {
    const config = await this.getConfig();
    const teamId = this.getRequiredTeamId(config);
    const parsedIssueUUID = issueUUID.trim();
    const payload = onesInternalTaskMessagesResponseSchema.parse(
      await this.get(
        `/project/api/project/team/${encodeURIComponent(teamId)}/task/${encodeURIComponent(parsedIssueUUID)}/messages`,
        {
          limit: options.limit
        }
      )
    );

    return {
      messages: payload.messages.map((message) => normalizeTaskMessage(message)),
      count: payload.count,
      hasNext: payload.has_next
    };
  }

  private async getConfig(): Promise<OnesInternalApiConfig> {
    return onesInternalApiConfigSchema.parse(this.options) as OnesInternalApiConfig;
  }

  private async requestWithSession(
    path: string,
    init: {
      method: 'GET' | 'POST' | 'PUT' | 'PATCH';
      body?: unknown;
      searchParams?: Record<string, string | number | boolean | null | undefined>;
    }
  ): Promise<unknown> {
    const config = await this.getConfig();
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: config.authorization
    };

    return requestJson({
      baseUrl: config.baseUrl,
      path,
      method: init.method,
      body: init.body,
      searchParams: init.searchParams,
      headers
    });
  }
}
