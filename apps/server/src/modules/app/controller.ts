import type { Context } from 'hono';
import { failure, success } from '../../lib/api-response.js';
import {
  disableInstallation,
  enableInstallation,
  getCurrentAppConfig,
  getCustomPageEntries,
  installApplication,
  InstallationBaseUrlConflictError,
  uninstallInstallation,
  updateCurrentAppConfig
} from './service.js';
import { AppAuthError, authenticateAppRequest } from '../../lib/app-auth.js';
import { getLogger } from '../../lib/logger.js';

const logger = getLogger('app.controller');

function getRequestBody<T>(c: Context): Promise<T> {
  return c.req.json<T>();
}

export async function installCallbackHandler(c: Context) {
  const payload = await getRequestBody<{
    installation_id: string;
    org_id?: string;
    ones_base_url: string;
    shared_secret: string;
  }>(c);

  logger.debug('[app.controller] install callback entered', {
    installationId: payload.installation_id,
    onesBaseUrl: payload.ones_base_url
  });

  try {
    const result = await installApplication(payload);
    logger.debug('[app.controller] install callback succeeded', {
      installationId: payload.installation_id
    });
    return c.json(success(result));
  } catch (error) {
    if (error instanceof InstallationBaseUrlConflictError) {
      return c.json(failure(error.message), 409);
    }

    logger.error('[app.controller] install callback failed', {
      installationId: payload.installation_id,
      error
    });
    throw error;
  }
}

async function handleLifecycleCallback(
  c: Context,
  actionName: 'enabled' | 'disabled' | 'uninstalled',
  action: (installationId: string) => Promise<unknown>
) {
  const payload = await getRequestBody<{
    installation_id: string;
  }>(c);

  try {
    const context = await authenticateAppRequest(c, {
      required: true,
      installationId: payload.installation_id,
      ignoreRequestStringHashMismatch: true
    });

    const result = await action(context.installationId);

    return c.json(success(result));
  } catch (error) {
    if (error instanceof AppAuthError) {
      logger.warn('[app.controller] lifecycle callback auth failed', {
        actionName,
        installationId: payload.installation_id,
        path: c.req.path,
        message: error.message,
        hasAuthorizationHeader: Boolean(c.req.header('authorization'))
      });
      return c.json(failure(error.message), 401);
    }

    logger.error('[app.controller] lifecycle callback failed', {
      actionName,
      installationId: payload.installation_id,
      path: c.req.path,
      error
    });
    throw error;
  }
}

export async function enabledCallbackHandler(c: Context) {
  return handleLifecycleCallback(c, 'enabled', enableInstallation);
}

export async function disabledCallbackHandler(c: Context) {
  return handleLifecycleCallback(c, 'disabled', disableInstallation);
}

export async function uninstalledCallbackHandler(c: Context) {
  return handleLifecycleCallback(c, 'uninstalled', uninstallInstallation);
}

export async function customPageEntriesHandler(c: Context) {
  try {
    const context = await authenticateAppRequest(c, {
      required: false
    });
    const payload = await getRequestBody<{
      language?: string;
    }>(c);

    const result = await getCustomPageEntries(payload.language);

    return c.json(result);
  } catch (error) {
    if (error instanceof AppAuthError) {
      return c.json(failure(error.message), 401);
    }

    throw error;
  }
}

export async function getAppConfigHandler(c: Context) {
  return c.json(success(await getCurrentAppConfig()));
}

export async function updateAppConfigHandler(c: Context) {
  const payload = await getRequestBody<{
    onesBaseUrl?: string | null;
    openApiAccessToken?: string | null;
  }>(c);

  try {
    return c.json(success(await updateCurrentAppConfig(payload)));
  } catch (error) {
    return c.json(
      failure(error instanceof Error ? error.message : 'App config updates are not supported'),
      410
    );
  }
}
