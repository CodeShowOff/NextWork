import { NotificationItem } from '../types';
import { FeedPost, PaginatedFeed } from '../../../shared/api/feed.api';

export type NotificationNavigationAction =
  | {
      type: 'navigate';
      target: 'messages';
      params: {
        screen: 'ConversationDetail';
        params: { conversationId: string };
      };
    }
  | {
      type: 'navigate';
      target: 'profile';
      params: {
        screen: 'UserProfile';
        params: { userId: string };
      };
    }
  | {
      type: 'navigate';
      target: 'feed';
      params:
        | {
            screen: 'PostDetail';
            params: { post: FeedPost };
          }
        | {
            screen: 'FeedHome';
          };
      needsFeedRefresh?: boolean;
      warningMessage?: string;
    };

export function resolveNotificationNavigationAction(params: {
  item: NotificationItem;
  feedCache?: { pageParams: unknown[]; pages: PaginatedFeed[] };
}): NotificationNavigationAction | null {
  const { item, feedCache } = params;

  if (item.entityType === 'conversation') {
    return {
      type: 'navigate',
      target: 'messages',
      params: {
        screen: 'ConversationDetail',
        params: { conversationId: item.entityId },
      },
    };
  }

  if (item.entityType === 'user') {
    return {
      type: 'navigate',
      target: 'profile',
      params: {
        screen: 'UserProfile',
        params: { userId: item.entityId },
      },
    };
  }

  if (item.entityType === 'post') {
    const post = feedCache?.pages.flatMap((page) => page.items).find((candidate) => candidate.id === item.entityId);

    if (post) {
      return {
        type: 'navigate',
        target: 'feed',
        params: {
          screen: 'PostDetail',
          params: { post },
        },
      };
    }

    return {
      type: 'navigate',
      target: 'feed',
      params: { screen: 'FeedHome' },
      needsFeedRefresh: true,
      warningMessage: 'Post unavailable',
    };
  }

  return null;
}
