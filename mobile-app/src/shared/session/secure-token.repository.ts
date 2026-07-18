const AUTH_SESSION_STORAGE_KEY = 'nextwork.auth.session.v1';

export interface StoredAuthSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
}

export interface SecureTokenRepository {
  load(): Promise<StoredAuthSession | null>;
  save(session: StoredAuthSession): Promise<void>;
  updateTokens(tokens: { accessToken: string; refreshToken: string }): Promise<StoredAuthSession | null>;
  clear(): Promise<void>;
}

let inMemoryFallbackValue: string | null = null;

async function getSecureStoreModule(): Promise<null | {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  isAvailableAsync: () => Promise<boolean>;
}> {
  try {
    const secureStore = await import('expo-secure-store');
    const available = await secureStore.isAvailableAsync();
    return available ? secureStore : null;
  } catch {
    return null;
  }
}

function parseStoredAuthSession(raw: string | null): StoredAuthSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.apiBaseUrl !== 'string' ||
      typeof parsed.realtimeBaseUrl !== 'string'
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      apiBaseUrl: parsed.apiBaseUrl,
      realtimeBaseUrl: parsed.realtimeBaseUrl,
    };
  } catch {
    return null;
  }
}

async function readRawSessionValue(): Promise<string | null> {
  const secureStore = await getSecureStoreModule();
  if (!secureStore) {
    return inMemoryFallbackValue;
  }

  return secureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);
}

async function writeRawSessionValue(value: string): Promise<void> {
  const secureStore = await getSecureStoreModule();
  if (!secureStore) {
    inMemoryFallbackValue = value;
    return;
  }

  await secureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, value);
}

async function deleteRawSessionValue(): Promise<void> {
  const secureStore = await getSecureStoreModule();
  if (!secureStore) {
    inMemoryFallbackValue = null;
    return;
  }

  await secureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
}

export const secureTokenRepository: SecureTokenRepository = {
  async load() {
    const stored = parseStoredAuthSession(await readRawSessionValue());
    if (stored) {
      return stored;
    }

    await deleteRawSessionValue();
    return null;
  },

  async save(session) {
    await writeRawSessionValue(JSON.stringify(session));
  },

  async updateTokens(tokens) {
    const current = await this.load();
    if (!current) {
      return null;
    }

    const nextSession: StoredAuthSession = {
      ...current,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };

    await this.save(nextSession);
    return nextSession;
  },

  async clear() {
    await deleteRawSessionValue();
  },
};
