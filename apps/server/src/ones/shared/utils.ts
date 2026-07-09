export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pickFirstString(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}
