import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getWorkspaceCryptoKey } from './app-secret.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;

export interface EncryptedSecretPayload {
  algorithm: typeof ENCRYPTION_ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export async function encryptSecret(
  value: string
): Promise<EncryptedSecretPayload> {
  const key = await getWorkspaceCryptoKey();
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);

  return {
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

export async function decryptSecret(
  payload: EncryptedSecretPayload
): Promise<string> {
  if (payload.algorithm !== ENCRYPTION_ALGORITHM) {
    throw new Error(`Unsupported secret algorithm: ${payload.algorithm}`);
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    await getWorkspaceCryptoKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
