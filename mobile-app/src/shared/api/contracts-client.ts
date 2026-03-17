import { createWorkplaceApiClient } from '@workplace/api-contracts';

import { useSessionStore } from '../session/session.store';
import { authSessionService } from '../session/auth-session.service';

export const workplaceApi = createWorkplaceApiClient({
  baseUrl: () => useSessionStore.getState().apiBaseUrl,
  getAccessToken: () => {
    const { accessToken } = useSessionStore.getState();
    return accessToken || undefined;
  },
  onUnauthorized: ({ path }) => authSessionService.handleUnauthorizedRequest(path),
});
