export const DEFAULT_LOCALE = 'en-US';
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'ja-JP'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

function normalizeLanguageTag(input: string): string {
  return input.trim().toLowerCase();
}

export function resolveLocale(
  input: string | null | undefined
): AppLocale | null {
  if (!input) {
    return null;
  }

  const normalized = normalizeLanguageTag(input);

  if (normalized === 'zh' || normalized.startsWith('zh-')) {
    return 'zh-CN';
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en-US';
  }

  if (normalized === 'ja' || normalized.startsWith('ja-')) {
    return 'ja-JP';
  }

  return null;
}

export function setDocumentLanguage(locale: AppLocale): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = locale;
}

export function toOnesLanguage(locale: AppLocale): 'zh' | 'en' {
  return locale.startsWith('zh') ? 'zh' : 'en';
}
