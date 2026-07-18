import { createNextWorkApiClient } from '@nextwork/api-contracts';

import { useSessionStore } from '../session/session.store';
import { authSessionService } from '../session/auth-session.service';

export const nextworkApi = createNextWorkApiClient({
  baseUrl: () => useSessionStore.getState().apiBaseUrl,
  getAccessToken: () => {
    const { accessToken } = useSessionStore.getState();
    return accessToken || undefined;
  },
  onUnauthorized: ({ path }) => authSessionService.handleUnauthorizedRequest(path),
});
