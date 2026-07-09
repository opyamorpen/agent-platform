import getSshKeys from 'micro-key-producer/ssh.js';
import { randomBytes } from 'micro-key-producer/utils.js';

export interface WorkspaceSshKeyPair {
  publicKey: string;
  privateKey: string;
}

export async function generateWorkspaceSshKeyPair(
  workspaceUUID: string
): Promise<WorkspaceSshKeyPair> {
  const keyPair = getSshKeys(randomBytes(32), `workspace:${workspaceUUID}`);

  return {
    privateKey: ensureTrailingNewline(keyPair.privateKey.trimEnd()),
    publicKey: keyPair.publicKey.trim()
  };
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}
