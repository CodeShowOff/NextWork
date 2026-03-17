const mockLoad = jest.fn();
const mockUpdateTokens = jest.fn();
const mockClearRepository = jest.fn();

const mockSetSession = jest.fn();
const mockClearSession = jest.fn();
const mockMarkHydrated = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    select: (value: Record<string, string>) => value.default ?? 'localhost',
  },
}));

jest.mock('./secure-token.repository', () => ({
  secureTokenRepository: {
    load: (...args: unknown[]) => mockLoad(...args),
    updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
    clear: (...args: unknown[]) => mockClearRepository(...args),
    save: jest.fn(),
  },
}));

jest.mock('./session.store', () => ({
  useSessionStore: {
    getState: () => ({
      userId: 'user-1',
      accessToken: 'stale-access-token',
      apiBaseUrl: 'https://api.example.com',
      realtimeBaseUrl: 'https://realtime.example.com',
      setSession: mockSetSession,
      clearSession: mockClearSession,
      markHydrated: mockMarkHydrated,
    }),
  },
}));

describe('authSessionService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_FLAG_AUTH_SESSION_REFRESH = 'true';
    (globalThis as any).fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_FLAG_AUTH_SESSION_REFRESH;
  });

  it('deduplicates concurrent token refresh requests to prevent race conditions', async () => {
    const deferred = (() => {
      let resolver: (value: unknown) => void = () => undefined;
      const promise = new Promise((resolve) => {
        resolver = resolve;
      });
      return { promise, resolver };
    })();

    mockLoad.mockResolvedValue({
      userId: 'user-1',
      accessToken: 'old-access-token',
      refreshToken: 'refresh-1',
      apiBaseUrl: 'https://api.example.com',
      realtimeBaseUrl: 'https://realtime.example.com',
    });

    (globalThis.fetch as jest.Mock).mockImplementation(async () => {
      await deferred.promise;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: { accessToken: 'new-access-token', refreshToken: 'refresh-2' },
            timestamp: '2026-03-17T00:00:00.000Z',
            path: '/auth/refresh',
          }),
      };
    });

    const { authSessionService } = await import('./auth-session.service');

    const first = authSessionService.refreshAccessToken();
    const second = authSessionService.refreshAccessToken();

    deferred.resolver(undefined);

    const [firstToken, secondToken] = await Promise.all([first, second]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(firstToken).toBe('new-access-token');
    expect(secondToken).toBe('new-access-token');
    expect(mockUpdateTokens).toHaveBeenCalledWith({
      accessToken: 'new-access-token',
      refreshToken: 'refresh-2',
    });
    expect(mockSetSession).toHaveBeenCalledWith({
      userId: 'user-1',
      accessToken: 'new-access-token',
      apiBaseUrl: 'https://api.example.com',
      realtimeBaseUrl: 'https://realtime.example.com',
    });
  });

  it('recovers from offline refresh failure and allows retry when online again', async () => {
    mockLoad.mockResolvedValue({
      userId: 'user-1',
      accessToken: 'old-access-token',
      refreshToken: 'refresh-1',
      apiBaseUrl: 'https://api.example.com',
      realtimeBaseUrl: 'https://realtime.example.com',
    });

    (globalThis.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: { accessToken: 'online-access-token', refreshToken: 'refresh-2' },
            timestamp: '2026-03-17T00:00:00.000Z',
            path: '/auth/refresh',
          }),
      });

    const { authSessionService } = await import('./auth-session.service');

    const offlineResult = await authSessionService.refreshAccessToken();
    const onlineResult = await authSessionService.refreshAccessToken();

    expect(offlineResult).toBeUndefined();
    expect(onlineResult).toBe('online-access-token');
    expect(mockClearRepository).toHaveBeenCalledTimes(1);
    expect(mockClearSession).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
