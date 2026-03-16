import { create } from 'zustand';

interface MessagesBadgeState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  reset: () => void;
}

export const useMessagesBadgeStore = create<MessagesBadgeState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => {
    set({ unreadCount: Math.max(0, count) });
  },
  reset: () => {
    set({ unreadCount: 0 });
  },
}));
