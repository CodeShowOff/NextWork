import { Platform } from 'react-native';

const defaultHost = Platform.select({
  android: '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});

export const defaultApiBaseUrl = `http://${defaultHost}:4000/api/v1`;
export const defaultRealtimeBaseUrl = `http://${defaultHost}:4000/realtime`;

function readBooleanFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export const featureFlags = {
  onboardingV2: true,
  i18n: true,
  authSessionRefresh: readBooleanFlag('EXPO_PUBLIC_FLAG_AUTH_SESSION_REFRESH', true),
  flashListRendering: readBooleanFlag('EXPO_PUBLIC_FLAG_FLASHLIST_RENDERING', true),
} as const;
