import { resolveNotificationNavigationAction } from './notification-navigation';
import { NotificationItem } from '../types';

const baseItem: NotificationItem = {
  id: 'n1',
  userId: 'u1',
  actorId: 'u2',
  type: 'message',
  entityType: 'conversation',
  entityId: 'c1',
  isRead: false,
  createdAt: '2026-03-16T00:00:00.000Z',
  actor: {
    id: 'u2',
    displayName: 'User Two',
    avatarUrl: null,
  },
};

describe('resolveNotificationNavigationAction', () => {
  it('routes conversation notifications to messages detail', () => {
    const action = resolveNotificationNavigationAction({
      item: baseItem,
    });

    expect(action).toEqual({
      type: 'navigate',
      target: 'messages',
      params: {
        screen: 'ConversationDetail',
        params: { conversationId: 'c1' },
      },
    });
  });

  it('routes user notifications to profile', () => {
    const action = resolveNotificationNavigationAction({
      item: {
        ...baseItem,
        entityType: 'user',
        entityId: 'u9',
      },
    });

    expect(action).toEqual({
      type: 'navigate',
      target: 'profile',
      params: {
        screen: 'UserProfile',
        params: { userId: 'u9' },
      },
    });
  });

  it('routes post notifications to detail when post exists in cache', () => {
    const action = resolveNotificationNavigationAction({
      item: {
        ...baseItem,
        entityType: 'post',
        entityId: 'p1',
      },
      feedCache: {
        pageParams: [undefined],
        pages: [
          {
            items: [
              {
                id: 'p1',
                authorId: 'u1',
                groupId: null,
                content: 'hello',
                visibility: 'public',
                createdAt: '2026-03-16T00:00:00.000Z',
                updatedAt: '2026-03-16T00:00:00.000Z',
                media: [],
                taggedUserIds: [],
                hashtags: [],
                poll: null,
                author: {
                  id: 'u1',
                  displayName: 'User One',
                  avatarUrl: null,
                },
                stats: {
                  likeCount: 0,
                  commentCount: 0,
                },
              },
            ],
            nextCursor: null,
          },
        ],
      },
    });

    expect(action?.type).toBe('navigate');
    if (!action || action.type !== 'navigate' || action.target !== 'feed') {
      throw new Error('Unexpected action type');
    }

    expect(action.params.screen).toBe('PostDetail');
  });

  it('routes post notifications to feed home and marks refresh when cache misses', () => {
    const action = resolveNotificationNavigationAction({
      item: {
        ...baseItem,
        entityType: 'post',
        entityId: 'missing-post',
      },
      feedCache: {
        pageParams: [undefined],
        pages: [{ items: [], nextCursor: null }],
      },
    });

    expect(action).toEqual({
      type: 'navigate',
      target: 'feed',
      params: { screen: 'FeedHome' },
      needsFeedRefresh: true,
      warningMessage: 'Post unavailable',
    });
  });
});
