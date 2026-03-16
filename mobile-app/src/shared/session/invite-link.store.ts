import { create } from 'zustand';

interface InviteLinkState {
  pendingInviteToken: string;
  setPendingInviteToken: (token: string) => void;
  clearPendingInviteToken: () => void;
}

export const useInviteLinkStore = create<InviteLinkState>((set) => ({
  pendingInviteToken: '',
  setPendingInviteToken: (token) => {
    set({ pendingInviteToken: token.trim() });
  },
  clearPendingInviteToken: () => {
    set({ pendingInviteToken: '' });
  },
}));
