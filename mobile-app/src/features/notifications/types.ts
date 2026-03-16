export interface NotificationItem {
  id: string;
  userId: string;
  actorId: string | null;
  type: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface NotificationReadEvent {
  notificationId?: string;
  readAll?: boolean;
}

export interface NotificationPreferences {
  likeEnabled: boolean;
  commentEnabled: boolean;
  followEnabled: boolean;
  messageEnabled: boolean;
}

export interface MutedNotificationUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}
