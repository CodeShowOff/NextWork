import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => set({ preference }),
}));

export function resolveAppTheme(preference: ThemePreference, systemScheme: 'light' | 'dark' | null) {
  const shouldUseDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  return shouldUseDark ? DarkTheme : DefaultTheme;
}
