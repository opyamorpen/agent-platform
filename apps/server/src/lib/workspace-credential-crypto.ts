import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecretPayload
} from './secret-crypto.js';

export type { EncryptedSecretPayload } from './secret-crypto.js';

export async function encryptWorkspaceCredentialValue(
  value: string
): Promise<EncryptedSecretPayload> {
  return encryptSecret(value);
}

export async function decryptWorkspaceCredentialValue(
  payload: EncryptedSecretPayload
): Promise<string> {
  return decryptSecret(payload);
}
