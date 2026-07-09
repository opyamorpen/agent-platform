import type { ApiError } from '@ones-ai-workflow/shared';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function getApiErrorMessage(
  payload: ApiError,
  t: Translate,
  fallbackKey: string
): string {
  if (payload.code) {
    const translationKey = `apiErrors.codes.${payload.code}`;
    const translated = t(translationKey);

    if (translated !== translationKey) {
      return translated;
    }
  }

  return payload.message || t(fallbackKey);
}

export function getErrorMessage(
  error: unknown,
  t: Translate,
  fallbackKey: string
): string {
  return error instanceof Error ? error.message : t(fallbackKey);
}
