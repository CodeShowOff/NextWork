import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources, supportedLocales, SupportedLocale } from './resources';

function resolveDeviceLocale(): SupportedLocale {
  const locales = getLocales();
  const first = locales[0];
  const tag = first?.languageTag?.toLowerCase() ?? '';

  if (tag.startsWith('en')) {
    return 'en';
  }

  return 'en';
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}

const initialLocale = resolveDeviceLocale();

void i18next.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export const i18n = i18next;
