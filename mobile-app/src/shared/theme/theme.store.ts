import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { resolveColors } from './palette';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'nextwork.theme-preference',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preference: state.preference }),
    },
  ),
);

export function resolveAppTheme(preference: ThemePreference, systemScheme: 'light' | 'dark' | null) {
  const colors = resolveColors(preference, systemScheme);
  const base = preference === 'dark' || (preference === 'system' && systemScheme === 'dark') ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
