import { create } from 'zustand';

import { defaultApiBaseUrl, defaultRealtimeBaseUrl } from '../config/runtime';

interface SessionState {
  userId: string;
  accessToken: string;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
  setSession: (params: {
    userId: string;
    accessToken: string;
    apiBaseUrl?: string;
    realtimeBaseUrl?: string;
  }) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  userId: '',
  accessToken: '',
  apiBaseUrl: defaultApiBaseUrl,
  realtimeBaseUrl: defaultRealtimeBaseUrl,
  setSession: ({ userId, accessToken, apiBaseUrl, realtimeBaseUrl }) => {
    set({
      userId,
      accessToken,
      apiBaseUrl: apiBaseUrl?.trim() || defaultApiBaseUrl,
      realtimeBaseUrl: realtimeBaseUrl?.trim() || defaultRealtimeBaseUrl,
    });
  },
  clearSession: () => {
    set({
      userId: '',
      accessToken: '',
      apiBaseUrl: defaultApiBaseUrl,
      realtimeBaseUrl: defaultRealtimeBaseUrl,
    });
  },
}));
