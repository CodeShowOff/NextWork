import { NativeModules, Platform } from 'react-native';

type ExpoConstantsShape = {
  isDevice?: boolean;
  expoConfig?: { hostUri?: string } | null;
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string;
      };
    };
  };
  manifest?: { debuggerHost?: string };
};

function loadExpoConstants(): ExpoConstantsShape {
  try {
    // Use require to avoid Jest parsing Expo ESM modules when running node-based tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-constants').default as ExpoConstantsShape;
  } catch {
    return {};
  }
}

const constants = loadExpoConstants();

function extractHostFromExpoRuntime(): string | null {
  const expoConfigHostUri = constants.expoConfig?.hostUri;
  const manifest2HostUri = constants.manifest2?.extra?.expoClient?.hostUri;
  const legacyDebuggerHost = constants.manifest?.debuggerHost;
  const metroScriptUrl = (NativeModules as { SourceCode?: { scriptURL?: string } } | undefined)?.SourceCode
    ?.scriptURL;

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
  android: constants.isDevice ? 'localhost' : '10.0.2.2',
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
