import { OnesConfigError } from '../ones/errors.js';
import {
  getInstallationSecret,
  resolveCurrentInstallationId
} from './app-auth.js';

export interface InstallationInfo {
  installation_id: string;
  shared_secret: string;
  ones_base_url: string;
}

function normalizeRequiredString(
  value: string | null | undefined,
  fieldName: 'installation_id' | 'shared_secret' | 'ones_base_url'
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new OnesConfigError(`Installation info field is required: ${fieldName}`);
  }

  return normalized;
}

export async function resolveInstallationInfo(
  installationId?: string
): Promise<InstallationInfo> {
  const resolvedInstallationId =
    installationId?.trim() || (await resolveCurrentInstallationId());
  const installationSecret = await getInstallationSecret(resolvedInstallationId);

  if (!installationSecret) {
    throw new OnesConfigError(
      `Installation secret not found: ${resolvedInstallationId}`
    );
  }

  return {
    installation_id: normalizeRequiredString(
      installationSecret.installation_id,
      'installation_id'
    ),
    shared_secret: normalizeRequiredString(
      installationSecret.shared_secret,
      'shared_secret'
    ),
    ones_base_url: normalizeRequiredString(
      installationSecret.ones_base_url,
      'ones_base_url'
    )
  };
}

export async function resolveCurrentInstallationInfo(): Promise<InstallationInfo> {
  return resolveInstallationInfo();
}
