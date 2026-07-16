import type {
  AIModelConfig,
  AIModelConfigStatus
} from '@ones-ai-workflow/shared';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import {
  buildHostedObjectKey,
  readObjectJson,
  uploadObjectJson
} from '../../lib/hosted-storage.js';
import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecretPayload
} from '../../lib/secret-crypto.js';
import type { UpdateAIModelConfigDTO } from './dto.js';
import {
  findAIModelConfig,
  saveAIModelConfig,
  type AIModelConfigRecord
} from './repository.js';

export class AIModelNotConfiguredError extends Error {
  constructor() {
    super('The organization AI model is not configured');
    this.name = 'AIModelNotConfiguredError';
  }
}

export class UnsafeAIModelBaseURLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeAIModelBaseURLError';
  }
}

export interface AIModelRuntimeConfig extends AIModelConfigRecord {
  apiKey: string;
}

export async function getAIModelConfigStatus(
  teamUUID: string
): Promise<AIModelConfigStatus> {
  const config = await findAIModelConfig(teamUUID);
  return { configured: isConfigured(config) };
}

export async function getAIModelConfig(
  teamUUID: string
): Promise<AIModelConfig> {
  const config = await findAIModelConfig(teamUUID);

  return (
    config ?? {
      provider: 'openai-compatible',
      baseURL: '',
      model: '',
      temperature: 0.2,
      hasAPIKey: false,
      updatedBy: null,
      updatedAt: null
    }
  );
}

export async function updateAIModelConfig(
  payload: UpdateAIModelConfigDTO,
  teamUUID: string,
  userUUID: string
): Promise<AIModelConfig> {
  await assertPublicHTTPSURL(payload.baseURL);
  const baseURL = normalizeBaseURL(payload.baseURL);
  const current = await findAIModelConfig(teamUUID);
  let secretObjectKey = current?.secretObjectKey ?? '';

  if (payload.apiKey) {
    secretObjectKey = buildHostedObjectKey('ai-model-secret', teamUUID);
    await uploadObjectJson(
      secretObjectKey,
      await encryptSecret(payload.apiKey)
    );
  }

  const saved = await saveAIModelConfig({
    teamUUID,
    baseURL,
    model: payload.model,
    temperature: payload.temperature,
    secretObjectKey,
    updatedBy: userUUID
  });

  return saved;
}

export async function getAIModelRuntimeConfig(
  teamUUID: string
): Promise<AIModelRuntimeConfig> {
  const config = await findAIModelConfig(teamUUID);

  if (!isConfigured(config)) {
    throw new AIModelNotConfiguredError();
  }

  await assertPublicHTTPSURL(config.baseURL);
  const encrypted = await readObjectJson<EncryptedSecretPayload>(
    config.secretObjectKey
  );

  if (!encrypted) {
    throw new AIModelNotConfiguredError();
  }

  return {
    ...config,
    apiKey: await decryptSecret(encrypted)
  };
}

function isConfigured(
  config: AIModelConfigRecord | null
): config is AIModelConfigRecord {
  return Boolean(config?.baseURL && config.model && config.secretObjectKey);
}

export function normalizeBaseURL(value: string): string {
  const url = new URL(value.trim());
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export async function assertPublicHTTPSURL(value: string): Promise<void> {
  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new UnsafeAIModelBaseURLError('AI model Base URL must use HTTPS');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new UnsafeAIModelBaseURLError(
      'AI model Base URL cannot contain credentials, query parameters, or fragments'
    );
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new UnsafeAIModelBaseURLError(
      'AI model Base URL must be publicly reachable'
    );
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new UnsafeAIModelBaseURLError(
      'AI model Base URL resolves to a private address'
    );
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized.includes(':')) {
    if (normalized.startsWith('::ffff:')) {
      return isPrivateAddress(normalized.slice('::ffff:'.length));
    }

    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    );
  }

  const [a, b] = normalized.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && typeof b === 'number' && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && typeof b === 'number' && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (typeof a === 'number' && a >= 224)
  );
}
