import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

function extractHostFromExpoRuntime(): string | null {
  const expoConfigHostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  const manifest2HostUri = (
    Constants as {
      manifest2?: {
        extra?: {
          expoClient?: {
            hostUri?: string;
          };
        };
      };
    }
  ).manifest2?.extra?.expoClient?.hostUri;
  const legacyDebuggerHost = (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  const metroScriptUrl = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL;

  const rawHostUri = expoConfigHostUri || manifest2HostUri || legacyDebuggerHost || metroScriptUrl;
  if (!rawHostUri) {
    return null;
  }

  if (rawHostUri.startsWith('http://') || rawHostUri.startsWith('https://')) {
    try {
      return new URL(rawHostUri).hostname;
    } catch {
      // Continue with fallback parser.
    }
  }

  const host = rawHostUri.replace(/^https?:\/\//, '').split(':')[0]?.trim();
  return host || null;
}

const fallbackHost = Platform.select({
  android: Constants.isDevice ? 'localhost' : '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});

const runtimeHost = extractHostFromExpoRuntime() || fallbackHost;
const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const envRealtimeBaseUrl = process.env.EXPO_PUBLIC_REALTIME_BASE_URL?.trim();

export const defaultApiBaseUrl = envApiBaseUrl || `http://${runtimeHost}:4000/api/v1`;
export const defaultRealtimeBaseUrl = envRealtimeBaseUrl || `http://${runtimeHost}:4000/realtime`;

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
