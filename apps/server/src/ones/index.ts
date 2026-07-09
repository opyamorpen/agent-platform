import { OnesInternalApiClient } from './internal-api/client.js';
import { OnesOpenApiClient } from './open-api/client.js';
import {
  resolveInternalApiConfig,
  resolveOpenApiConfig
} from '../lib/ones-client-config.js';
import { resolveCurrentInstallationInfo } from '../lib/installation-info.js';
import type {
  OnesInternalApiContext,
  OnesOpenApiContext
} from './context.js';

export async function createOnesOpenApiClient(
  context: OnesOpenApiContext
): Promise<OnesOpenApiClient> {
  const initialConfig = await resolveOpenApiConfig(context);

  return new OnesOpenApiClient({
    ...initialConfig,
    resolveConfig: (options) => resolveOpenApiConfig(context, options)
  });
}

export async function createOnesInternalApiClient(
  context: OnesInternalApiContext
): Promise<OnesInternalApiClient> {
  return new OnesInternalApiClient(await resolveInternalApiConfig(context));
}

export async function createOnesInternalAuthClient(
  authorizationHeader: string
): Promise<OnesInternalApiClient> {
  const installationInfo = await resolveCurrentInstallationInfo();

  return new OnesInternalApiClient({
    baseUrl: installationInfo.ones_base_url,
    authorization: authorizationHeader
  });
}
