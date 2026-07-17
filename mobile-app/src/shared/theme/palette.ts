export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  success: string;
  focus: string;
  overlay: string;
  tab: string;
};

const light: AppColors = {
  background: '#F5F7FA', surface: '#FFFFFF', surfaceMuted: '#EEF2F6', text: '#152033', textMuted: '#667085',
  border: '#D9E0E8', primary: '#2457D6', primaryPressed: '#1B45AC', onPrimary: '#FFFFFF', danger: '#C73737',
  onDanger: '#FFFFFF', success: '#167A4A', focus: '#78A9FF', overlay: 'rgba(21, 32, 51, 0.44)', tab: '#FFFFFF',
};

const dark: AppColors = {
  background: '#111827', surface: '#192234', surfaceMuted: '#25324A', text: '#F5F8FC', textMuted: '#B0BDD0',
  border: '#35435A', primary: '#8BAEFF', primaryPressed: '#B3C9FF', onPrimary: '#0E1A2B', danger: '#FF9B9B',
  onDanger: '#321313', success: '#6ED19D', focus: '#B3C9FF', overlay: 'rgba(0, 0, 0, 0.58)', tab: '#192234',
};

export function resolveColors(preference: 'system' | 'light' | 'dark', systemScheme: 'light' | 'dark' | null): AppColors {
  return preference === 'dark' || (preference === 'system' && systemScheme === 'dark') ? dark : light;
}
