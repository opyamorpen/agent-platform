import { createHash } from 'node:crypto';
import { createEntityStore } from './hosted-storage.js';
import { resolveCurrentInstallationInfo } from './installation-info.js';
import { getLogger } from './logger.js';

const APP_SECRET_ENTITY_NAME = 'app_secret';
const WORKSPACE_CRYPTO_SECRET_KEY = 'workspace_crypto';
const WORKSPACE_CRYPTO_SECRET_NAMESPACE = 'workspace-crypto:v1';

interface AppSecretEntity {
  key: string;
  secret: string;
  created_at: number;
  updated_at: number;
}

interface WorkspaceCryptoSecretResolverDependencies {
  loadSecret: () => Promise<string | null>;
  saveSecret: (secret: string) => Promise<void>;
  resolveBootstrapSharedSecret: () => Promise<string>;
}

const appSecretStore = createEntityStore<AppSecretEntity>(APP_SECRET_ENTITY_NAME);
const logger = getLogger('app-secret');
let cachedWorkspaceCryptoKey: Buffer | null = null;
let workspaceCryptoKeyPromise: Promise<Buffer> | null = null;

export async function getWorkspaceCryptoKey(): Promise<Buffer> {
  if (cachedWorkspaceCryptoKey) {
    return cachedWorkspaceCryptoKey;
  }

  if (workspaceCryptoKeyPromise) {
    return workspaceCryptoKeyPromise;
  }

  workspaceCryptoKeyPromise = (async () => {
    const secretValue = await resolveWorkspaceCryptoSecretValue({
      loadSecret: async () => {
        const record = await loadWorkspaceCryptoRecord();
        return normalizeStoredSecret(record?.secret);
      },
      saveSecret: async (secret) => {
        const now = Date.now();
        const current = await loadWorkspaceCryptoRecord();

        await appSecretStore.set(WORKSPACE_CRYPTO_SECRET_KEY, {
          key: WORKSPACE_CRYPTO_SECRET_KEY,
          secret,
          created_at: current?.created_at ?? now,
          updated_at: now
        });
      },
      resolveBootstrapSharedSecret: async () =>
        (await resolveCurrentInstallationInfo()).shared_secret
    });
    const decodedSecret = Buffer.from(secretValue, 'base64');

    if (decodedSecret.length !== 32) {
      throw new Error('Workspace crypto secret must decode to 32 bytes');
    }

    cachedWorkspaceCryptoKey = decodedSecret;
    return decodedSecret;
  })().finally(() => {
    workspaceCryptoKeyPromise = null;
  });

  return workspaceCryptoKeyPromise;
}

export async function resolveWorkspaceCryptoSecretValue(
  dependencies: WorkspaceCryptoSecretResolverDependencies
): Promise<string> {
  const storedSecret = normalizeStoredSecret(await dependencies.loadSecret());

  if (storedSecret) {
    return storedSecret;
  }

  const bootstrapSharedSecret = await dependencies.resolveBootstrapSharedSecret();
  const nextSecret = buildWorkspaceCryptoSecretValue(bootstrapSharedSecret);

  await dependencies.saveSecret(nextSecret);
  logger.info('[app-secret] initialized workspace crypto secret');
  return nextSecret;
}

export function buildWorkspaceCryptoSecretValue(sharedSecret: string): string {
  const decodedSharedSecret = Buffer.from(sharedSecret, 'base64');

  return createHash('sha256')
    .update(WORKSPACE_CRYPTO_SECRET_NAMESPACE)
    .update(decodedSharedSecret)
    .digest('base64');
}

function normalizeStoredSecret(secret: string | null | undefined): string | null {
  const normalizedSecret = secret?.trim();

  return normalizedSecret ? normalizedSecret : null;
}

async function loadWorkspaceCryptoRecord(): Promise<AppSecretEntity | undefined> {
  try {
    return await appSecretStore.get(WORKSPACE_CRYPTO_SECRET_KEY);
  } catch (error) {
    if (isHostedEntityNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }
}

function isHostedEntityNotFoundError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EntityNotFound'
  );
}
