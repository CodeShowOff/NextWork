export const notificationsKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationsKeys.all, 'list'] as const,
  unread: () => [...notificationsKeys.all, 'unread'] as const,
  preferences: () => [...notificationsKeys.all, 'preferences'] as const,
  mutedUsers: () => [...notificationsKeys.all, 'muted-users'] as const,
};
