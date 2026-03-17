import { Platform } from 'react-native';

const defaultHost = Platform.select({
  android: '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});

export const defaultApiBaseUrl = `http://${defaultHost}:4000/api/v1`;
export const defaultRealtimeBaseUrl = `http://${defaultHost}:4000/realtime`;

export const featureFlags = {
  onboardingV2: true,
  i18n: true,
} as const;
