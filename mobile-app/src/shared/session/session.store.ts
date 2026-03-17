import { create } from 'zustand';

import { defaultApiBaseUrl, defaultRealtimeBaseUrl } from '../config/runtime';

interface SessionState {
  hydrated: boolean;
  userId: string;
  accessToken: string;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
  markHydrated: (value: boolean) => void;
  setSession: (params: {
    userId: string;
    accessToken: string;
    apiBaseUrl?: string;
    realtimeBaseUrl?: string;
  }) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  hydrated: false,
  userId: '',
  accessToken: '',
  apiBaseUrl: defaultApiBaseUrl,
  realtimeBaseUrl: defaultRealtimeBaseUrl,
  markHydrated: (value) => {
    set({ hydrated: value });
  },
  setSession: ({ userId, accessToken, apiBaseUrl, realtimeBaseUrl }) => {
    set({
      hydrated: true,
      userId,
      accessToken,
      apiBaseUrl: apiBaseUrl?.trim() || defaultApiBaseUrl,
      realtimeBaseUrl: realtimeBaseUrl?.trim() || defaultRealtimeBaseUrl,
    });
  },
  clearSession: () => {
    set({
      hydrated: true,
      userId: '',
      accessToken: '',
      apiBaseUrl: defaultApiBaseUrl,
      realtimeBaseUrl: defaultRealtimeBaseUrl,
    });
  },
}));
