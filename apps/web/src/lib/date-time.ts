import type { AppLocale } from './locale';

export function formatDateTime(
  value: string | null,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { hour12: false }
): string {
  if (!value) {
    return '-';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString(locale, options);
}
