import { useColorScheme } from 'react-native';

import { useThemeStore } from '../theme/theme.store';
import { AppColors, resolveColors as resolvePaletteColors } from '../theme/palette';

export type { AppColors } from '../theme/palette';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const resolveColors = resolvePaletteColors;

export function useAppColors(): AppColors {
  const preference = useThemeStore((state) => state.preference);
  const systemScheme = useColorScheme();
  return resolvePaletteColors(preference, systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : null);
}
