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
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.5 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.4 },
} as const;

export const resolveColors = resolvePaletteColors;

export function useAppColors(): AppColors {
  const preference = useThemeStore((state) => state.preference);
  const systemScheme = useColorScheme();
  return resolvePaletteColors(
    preference,
    systemScheme === 'dark' || systemScheme === 'light' ? systemScheme : null,
  );
}
