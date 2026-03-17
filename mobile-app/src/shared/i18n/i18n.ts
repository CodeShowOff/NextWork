import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources, supportedLocales, SupportedLocale } from './resources';

const fallbackLocale: SupportedLocale = 'en';

function resolveSupportedLocale(raw: string | null | undefined): SupportedLocale | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  const exact = supportedLocales.find((locale) => locale.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }

  const base = normalized.split('-')[0];
  const baseMatch = supportedLocales.find((locale) => locale.toLowerCase() === base);
  return baseMatch ?? null;
}

function resolveDeviceLocale(): SupportedLocale {
  const locales = getLocales();
  const first = locales[0];
  return (
    resolveSupportedLocale(first?.languageTag) ??
    resolveSupportedLocale(first?.languageCode) ??
    fallbackLocale
  );
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}

const initialLocale = resolveDeviceLocale();

void i18next.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: fallbackLocale,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export const i18n = i18next;
