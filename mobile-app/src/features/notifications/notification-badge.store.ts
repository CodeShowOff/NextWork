import { create } from 'zustand';

interface NotificationBadgeState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
}

export const useNotificationBadgeStore = create<NotificationBadgeState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  increase: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  decrease: () =>
    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  reset: () => set({ unreadCount: 0 }),
}));
