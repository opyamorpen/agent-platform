import {
  getInstallationSecret,
  listInstallationSecrets,
  saveInstallationSecret
} from '../../lib/app-auth.js';
import { resolveCurrentInstallationInfo } from '../../lib/installation-info.js';
import { getLogger } from '../../lib/logger.js';

const APP_VERSION = 'v0.1.15';
const logger = getLogger('app.service');

export class InstallationBaseUrlConflictError extends Error {
  constructor(
    public readonly existingInstallationId: string,
    public readonly existingBaseUrl: string,
    public readonly requestedBaseUrl: string
  ) {
    super(
      `Installation base URL mismatch: current installation "${existingInstallationId}" is bound to "${existingBaseUrl}", received "${requestedBaseUrl}"`
    );
    this.name = 'InstallationBaseUrlConflictError';
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export async function installApplication(payload: {
  installation_id: string;
  org_id?: string;
  ones_base_url: string;
  shared_secret: string;
}) {
  const installationId = payload.installation_id.trim();
  const onesBaseUrl = normalizeBaseUrl(payload.ones_base_url);
  const now = Date.now();

  logger.debug('[app.service] installApplication start', {
    installationId,
    onesBaseUrl
  });

  const installations = await listInstallationSecrets();
  const conflictingInstallation = installations.find((installation) => {
    if (!installation.ones_base_url.trim()) {
      return false;
    }

    return normalizeBaseUrl(installation.ones_base_url) !== onesBaseUrl;
  });

  if (conflictingInstallation) {
    throw new InstallationBaseUrlConflictError(
      conflictingInstallation.installation_id,
      normalizeBaseUrl(conflictingInstallation.ones_base_url),
      onesBaseUrl
    );
  }

  await saveInstallationSecret({
    installation_id: installationId,
    org_id: payload.org_id?.trim() ?? '',
    ones_base_url: onesBaseUrl,
    shared_secret: payload.shared_secret.trim(),
    status: 'installed',
    app_version: APP_VERSION,
    updated_at: now
  });

  logger.debug('[app.service] installation secret saved', {
    installationId
  });

  return {
    ok: true
  };
}

async function updateInstallationStatus(
  installationId: string,
  status: 'enabled' | 'disabled' | 'uninstalled'
) {
  const existing = await getInstallationSecret(installationId);

  if (!existing) {
    return {
      ok: false,
      error: 'installation not found'
    };
  }

  await saveInstallationSecret({
    ...existing,
    status,
    updated_at: Date.now()
  });

  return {
    ok: true
  };
}

export async function enableInstallation(installationId: string) {
  return updateInstallationStatus(installationId, 'enabled');
}

export async function disableInstallation(installationId: string) {
  return updateInstallationStatus(installationId, 'disabled');
}

export async function uninstallInstallation(installationId: string) {
  return updateInstallationStatus(installationId, 'uninstalled');
}

export async function getCustomPageEntries(language = 'en') {
  const normalizedLanguage = language.toLowerCase();
  const isZh = normalizedLanguage.startsWith('zh');
  const isJa = normalizedLanguage.startsWith('ja');
  const title = isZh ? '使用说明' : isJa ? '利用ガイド' : 'Usage Guide';

  return {
    entries: [
      {
        title,
        page_url: isZh
          ? '/modules/app-settings/app-settings/index.zh-CN.html'
          : isJa
            ? '/modules/app-settings/app-settings/index.ja-JP.html'
            : '/modules/app-settings/app-settings/index.en-US.html'
      }
    ]
  };
}

export async function getCurrentAppConfig(): Promise<{
  onesBaseUrl: string | null;
  openApiAccessToken: string | null;
}> {
  return {
    onesBaseUrl: (await resolveCurrentInstallationInfo()).ones_base_url,
    openApiAccessToken: null
  };
}

export async function updateCurrentAppConfig(
  _payload: Partial<{
    onesBaseUrl: string | null;
    openApiAccessToken: string | null;
  }>
): Promise<never> {
  throw new Error(
    'App config updates are no longer supported. Use install callback to manage installation configuration.'
  );
}
