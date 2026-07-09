import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Context } from 'hono';
import { createEntityStore, HostedStorageConfigError } from './hosted-storage.js';
import { getLogger } from './logger.js';

export interface InstallationSecretEntity {
  installation_id: string;
  org_id: string;
  ones_base_url: string;
  shared_secret: string;
  status: string;
  app_version: string;
  updated_at: number;
}

const DEFAULT_INSTALLATION_ID =
  process.env.DEFAULT_INSTALLATION_ID?.trim() || 'default';
const APP_ID =
  process.env.ONES_HOSTED_APP_ID?.trim() ||
  process.env.APP_ID?.trim() ||
  'app_onesaiworkflow02';

const installationSecretStore =
  createEntityStore<InstallationSecretEntity>('installation_secret');
const installationSecretsCache = new Map<string, InstallationSecretEntity>();
const logger = getLogger('app-auth');
let installationSecretsCacheInitialized = false;
let installationSecretsCachePromise: Promise<void> | null = null;

export class AppAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppAuthError';
  }
}

export function getDefaultInstallationId(): string {
  return DEFAULT_INSTALLATION_ID;
}

function replaceInstallationSecretsCache(
  secrets: readonly InstallationSecretEntity[]
): void {
  installationSecretsCache.clear();

  for (const secret of secrets) {
    installationSecretsCache.set(secret.installation_id, secret);
  }

  installationSecretsCacheInitialized = true;
}

export async function initializeInstallationSecretsCache(): Promise<void> {
  if (installationSecretsCacheInitialized) {
    return;
  }

  if (installationSecretsCachePromise) {
    return installationSecretsCachePromise;
  }

  installationSecretsCachePromise = (async () => {
    try {
      const entries = await installationSecretStore.getMany();
      replaceInstallationSecretsCache(entries.map((entry) => entry.value));
    } catch (error) {
      if (error instanceof HostedStorageConfigError) {
        logger.warn(
          '[app-auth] hosted storage unavailable, initialize installation cache as empty'
        );
        replaceInstallationSecretsCache([]);
        return;
      }

      throw error;
    }
  })().finally(() => {
    installationSecretsCachePromise = null;
  });

  return installationSecretsCachePromise;
}

async function ensureInstallationSecretsCache(): Promise<void> {
  if (installationSecretsCacheInitialized) {
    return;
  }

  await initializeInstallationSecretsCache();
}

function isAppJwtAudience(audience: unknown): boolean {
  if (typeof audience === 'string') {
    return audience === APP_ID;
  }

  if (Array.isArray(audience)) {
    return audience.includes(APP_ID);
  }

  return false;
}

function getBearerToken(c: Context): string | null {
  const authorization = c.req.header('authorization');

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function resolveCurrentInstallationId(): Promise<string> {
  const secrets = await listInstallationSecrets();

  if (secrets.length === 0) {
    return DEFAULT_INSTALLATION_ID;
  }

  const enabledInstallations = secrets.filter(
    (secret) => secret.status === 'enabled'
  );

  if (enabledInstallations.length === 1) {
    return enabledInstallations[0].installation_id;
  }

  if (enabledInstallations.length > 1) {
    return [...enabledInstallations].sort(
      (left, right) => right.updated_at - left.updated_at
    )[0].installation_id;
  }

  const installedInstallations = secrets.filter((secret) =>
    ['installed', 'disabled', 'uninstalled'].includes(secret.status)
  );

  if (installedInstallations.length === 1) {
    return installedInstallations[0].installation_id;
  }

  if (installedInstallations.length > 1) {
    return [...installedInstallations].sort(
      (left, right) => right.updated_at - left.updated_at
    )[0].installation_id;
  }

  return DEFAULT_INSTALLATION_ID;
}

function validateRequestStringHash(
  c: Context,
  expectedHash: string
): boolean {
  const url = new URL(c.req.url);
  const signaturePayload = `${c.req.method.toUpperCase()}:${c.req.path}:${url.searchParams.toString()}`;
  const computedHash = createHash('sha256')
    .update(signaturePayload)
    .digest('hex');

  return computedHash === expectedHash;
}

export async function getInstallationSecret(
  installationId: string
): Promise<InstallationSecretEntity | undefined> {
  await ensureInstallationSecretsCache();
  return installationSecretsCache.get(installationId);
}

export async function saveInstallationSecret(
  secret: InstallationSecretEntity
): Promise<void> {
  await installationSecretStore.set(secret.installation_id, secret);
  installationSecretsCache.set(secret.installation_id, secret);
  installationSecretsCacheInitialized = true;
}

export async function listInstallationSecrets(options: {
  status?: string;
} = {}): Promise<InstallationSecretEntity[]> {
  await ensureInstallationSecretsCache();

  return Array.from(installationSecretsCache.values())
    .filter((secret) => {
      if (!options.status) {
        return true;
      }

      return secret.status === options.status;
    });
}

export async function authenticateAppRequest(
  c: Context,
  options: {
    required?: boolean;
    installationId?: string;
    ignoreRequestStringHashMismatch?: boolean;
  } = {}
): Promise<{
  installationId: string;
  userUUID?: string;
  authorizationHeader?: string;
}> {
  const token = getBearerToken(c);
  const authorizationHeader = c.req.header('authorization') ?? undefined;

  if (!token) {
    if (options.required) {
      throw new AppAuthError('Missing Authorization header');
    }

    return {
      installationId:
        options.installationId ?? (await resolveCurrentInstallationId()),
      authorizationHeader
    };
  }

  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded !== 'object') {
    throw new AppAuthError('Invalid JWT payload');
  }

  if (!isAppJwtAudience(decoded.aud)) {
    if (options.required) {
      throw new AppAuthError('Invalid JWT audience');
    }

    return {
      installationId:
        options.installationId ?? (await resolveCurrentInstallationId()),
      authorizationHeader
    };
  }

  const installationId =
    options.installationId ??
    (typeof decoded.sub === 'string' ? decoded.sub : undefined);

  if (!installationId) {
    throw new AppAuthError('Missing installation identifier');
  }

  const installationSecret = await getInstallationSecret(installationId);

  if (!installationSecret?.shared_secret) {
    throw new AppAuthError('Shared secret not found for installation');
  }

  const verified = jwt.verify(
    token,
    Buffer.from(installationSecret.shared_secret, 'base64'),
    {
      algorithms: ['HS256'],
      clockTolerance: 5
    }
  );

  if (!verified || typeof verified !== 'object') {
    throw new AppAuthError('Invalid JWT claims');
  }

  if (!isAppJwtAudience(verified.aud)) {
    throw new AppAuthError('Invalid JWT audience');
  }

  if (verified.sub !== installationId) {
    throw new AppAuthError('Installation ID mismatch');
  }

  if (typeof verified.rsh === 'string' && verified.rsh) {
    const isValidRequestStringHash = validateRequestStringHash(c, verified.rsh);

    if (!isValidRequestStringHash) {
      if (options.ignoreRequestStringHashMismatch) {
        logger.warn('[app-auth] request string hash mismatch ignored', {
          installationId,
          path: c.req.path,
          method: c.req.method,
          query: new URL(c.req.url).searchParams.toString()
        });
      } else {
        throw new AppAuthError('Request string hash mismatch');
      }
    }
  }

  return {
    installationId,
    userUUID: typeof verified.uid === 'string' ? verified.uid : undefined,
    authorizationHeader
  };
}
