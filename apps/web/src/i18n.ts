import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  resolveLocale,
  setDocumentLanguage,
  type AppLocale
} from '@/lib/locale';
import { SUPPORTED_LOCALES } from '@/lib/locale';
import { enUS } from '@/i18n/resources/en-US';
import { jaJP } from '@/i18n/resources/ja-JP';
import { zhCN } from '@/i18n/resources/zh-CN';

const initialLocale = DEFAULT_LOCALE;

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': {
      translation: zhCN
    },
    'en-US': {
      translation: enUS
    },
    'ja-JP': {
      translation: jaJP
    }
  },
  lng: initialLocale,
  fallbackLng: 'zh-CN',
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: {
    escapeValue: false
  },
  returnNull: false
});

setDocumentLanguage(initialLocale);

i18n.on('languageChanged', (language) => {
  const locale = (SUPPORTED_LOCALES.find((item) => item === language) ??
    DEFAULT_LOCALE) as AppLocale;
  setDocumentLanguage(locale);
});

export async function syncI18nWithOnesLanguage(
  language: string | null | undefined
): Promise<AppLocale> {
  const locale = resolveLocale(language) ?? DEFAULT_LOCALE;
  const currentLocale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);

  if (currentLocale === locale) {
    setDocumentLanguage(locale);
    return locale;
  }

  await i18n.changeLanguage(locale);
  return locale;
}

export { i18n };
