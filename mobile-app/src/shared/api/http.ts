import { requestJsonWithOptions } from '@nextwork/api-contracts';

import { useSessionStore } from '../session/session.store';
import { authSessionService } from '../session/auth-session.service';

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJsonWithOptions<T>(
    {
      baseUrl: () => useSessionStore.getState().apiBaseUrl,
      getAccessToken: () => useSessionStore.getState().accessToken || undefined,
      onUnauthorized: ({ path }) => authSessionService.handleUnauthorizedRequest(path),
    },
    path,
    init,
  );
}
