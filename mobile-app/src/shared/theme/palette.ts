export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;
  surfaceTint: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  onAccent: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  success: string;
  warning: string;
  info: string;
  focus: string;
  overlay: string;
  tab: string;
  tabInactive: string;
  skeleton: string;
  skeletonHighlight: string;
};

const light: AppColors = {
  background: '#F6F5FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F0EEF6',
  surfaceRaised: '#FFFFFF',
  surfaceTint: '#F3EEFF',
  text: '#24212D',
  textMuted: '#6D6877',
  textSubtle: '#8C8796',
  border: '#E2DEE9',
  borderStrong: '#C9C1D6',
  primary: '#5B2BCE',
  primaryPressed: '#43209A',
  primarySoft: '#E7DFFF',
  accent: '#FFD34E',
  onAccent: '#382B00',
  onPrimary: '#FFFFFF',
  danger: '#C9364A',
  onDanger: '#FFFFFF',
  success: '#167554',
  warning: '#B66904',
  info: '#315BC6',
  focus: '#8D70E7',
  overlay: 'rgba(29, 22, 46, 0.52)',
  tab: '#FFFFFF',
  tabInactive: '#797283',
  skeleton: '#ECE9F1',
  skeletonHighlight: '#F7F5F9',
};

const dark: AppColors = {
  background: '#17141F',
  surface: '#211D2B',
  surfaceMuted: '#2B2637',
  surfaceRaised: '#2A2536',
  surfaceTint: '#342851',
  text: '#F7F3FC',
  textMuted: '#C4BDCE',
  textSubtle: '#9D95A8',
  border: '#403949',
  borderStrong: '#5B5267',
  primary: '#B79BFF',
  primaryPressed: '#D6C8FF',
  primarySoft: '#382A59',
  accent: '#FFE083',
  onAccent: '#382B00',
  onPrimary: '#211535',
  danger: '#FFB3BE',
  onDanger: '#4D1020',
  success: '#75D9AD',
  warning: '#FFCC78',
  info: '#AEBEFF',
  focus: '#D1C0FF',
  overlay: 'rgba(0, 0, 0, 0.68)',
  tab: '#211D2B',
  tabInactive: '#B6ADBF',
  skeleton: '#322C3D',
  skeletonHighlight: '#40394C',
};

export function resolveColors(
  preference: 'system' | 'light' | 'dark',
  systemScheme: 'light' | 'dark' | null,
): AppColors {
  return preference === 'dark' || (preference === 'system' && systemScheme === 'dark')
    ? dark
    : light;
}
