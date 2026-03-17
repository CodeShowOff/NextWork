import { create } from 'zustand';

import { i18n, isSupportedLocale } from './i18n';
import { supportedLocales, SupportedLocale } from './resources';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

const resolved = i18n.resolvedLanguage;
const initialLocale: SupportedLocale =
  resolved && isSupportedLocale(resolved) ? resolved : 'en';

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    i18n.changeLanguage(locale);
    set({ locale });
  },
}));

export function useLocaleOptions(): Array<{ value: SupportedLocale; label: string }> {
  return supportedLocales.map((locale) => ({
    value: locale,
    label: locale,
  }));
}
