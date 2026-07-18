import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { i18n, isSupportedLocale } from './i18n';
import { localeLabels, supportedLocales, SupportedLocale } from './resources';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

const resolved = i18n.resolvedLanguage;
const initialLocale: SupportedLocale = resolved && isSupportedLocale(resolved) ? resolved : 'en';

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: initialLocale,
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
    }),
    {
      name: 'nextwork.locale-preference',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          void i18n.changeLanguage(state.locale);
        }
      },
    },
  ),
);

export function useLocaleOptions(): Array<{ value: SupportedLocale; label: string }> {
  return supportedLocales.map((locale) => ({ value: locale, label: localeLabels[locale] }));
}
