import { defaultApiBaseUrl, defaultRealtimeBaseUrl, featureFlags } from '../config/runtime';
import { i18n } from '../i18n/i18n';
import { useSessionStore } from './session.store';
import { secureTokenRepository } from './secure-token.repository';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
  path: string;
}

interface EstablishSessionParams {
  userId: string;
  tokens: AuthTokens;
  apiBaseUrl?: string;
  realtimeBaseUrl?: string;
}

function normalizeBaseUrl(url?: string): string {
  return url?.trim() || defaultApiBaseUrl;
}

function normalizeRealtimeUrl(url?: string): string {
  return url?.trim() || defaultRealtimeBaseUrl;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapEnvelope<T>(value: unknown): T {
  if (
    isObject(value) &&
    value.success === true &&
    'data' in value &&
    'timestamp' in value &&
    'path' in value
  ) {
    return (value as unknown as ApiEnvelope<T>).data;
  }

  return value as T;
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestRefreshTokens(baseUrl: string, refreshToken: string): Promise<AuthTokens> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(typeof payload === 'string' ? payload : i18n.t('auth.alerts.refreshFailedStatus', { status: response.status }));
  }

  return unwrapEnvelope<AuthTokens>(payload);
}

let refreshInFlight: Promise<string | undefined> | null = null;

function authPathSkipsRefresh(path: string): boolean {
  return path === '/auth/login' || path === '/auth/signup' || path === '/auth/refresh' || path === '/auth/logout';
}

export const authSessionService = {
  async hydrateSessionFromStorage(): Promise<void> {
    const store = useSessionStore.getState();
    store.markHydrated(false);

    const stored = await secureTokenRepository.load();
    if (!stored) {
      useSessionStore.getState().clearSession();
      return;
    }

    useSessionStore.getState().setSession({
      userId: stored.userId,
      accessToken: stored.accessToken,
      apiBaseUrl: stored.apiBaseUrl,
      realtimeBaseUrl: stored.realtimeBaseUrl,
    });
  },

  async establishSession(params: EstablishSessionParams): Promise<void> {
    const apiBaseUrl = normalizeBaseUrl(params.apiBaseUrl);
    const realtimeBaseUrl = normalizeRealtimeUrl(params.realtimeBaseUrl);

    await secureTokenRepository.save({
      userId: params.userId,
      accessToken: params.tokens.accessToken,
      refreshToken: params.tokens.refreshToken,
      apiBaseUrl,
      realtimeBaseUrl,
    });

    useSessionStore.getState().setSession({
      userId: params.userId,
      accessToken: params.tokens.accessToken,
      apiBaseUrl,
      realtimeBaseUrl,
    });
  },

  async clearSession(): Promise<void> {
    await secureTokenRepository.clear();
    useSessionStore.getState().clearSession();
  },

  async logout(): Promise<void> {
    const state = useSessionStore.getState();
    const accessToken = state.accessToken.trim();

    if (accessToken) {
      await fetch(`${state.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => {
        // Server logout is best effort; local wipe remains mandatory.
      });
    }

    await this.clearSession();
  },

  async refreshAccessToken(): Promise<string | undefined> {
    if (!featureFlags.authSessionRefresh) {
      return undefined;
    }

    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = (async () => {
      const stored = await secureTokenRepository.load();
      if (!stored) {
        await this.clearSession();
        return undefined;
      }

      try {
        const refreshed = await requestRefreshTokens(stored.apiBaseUrl, stored.refreshToken);
        await secureTokenRepository.updateTokens({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        });

        useSessionStore.getState().setSession({
          userId: stored.userId,
          accessToken: refreshed.accessToken,
          apiBaseUrl: stored.apiBaseUrl,
          realtimeBaseUrl: stored.realtimeBaseUrl,
        });

        return refreshed.accessToken;
      } catch {
        await this.clearSession();
        return undefined;
      }
    })();

    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  },

  async handleUnauthorizedRequest(path: string): Promise<string | undefined> {
    if (authPathSkipsRefresh(path)) {
      return undefined;
    }

    if (!featureFlags.authSessionRefresh) {
      return undefined;
    }

    return this.refreshAccessToken();
  },
};
