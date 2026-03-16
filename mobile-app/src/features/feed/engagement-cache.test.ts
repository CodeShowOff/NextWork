import {
  adjustCommentCountInFeed,
  applyOptimisticLikeToFeed,
  reconcileLikeCountInFeed,
} from './engagement-cache';
import { PaginatedFeed } from '../../shared/api/feed.api';

function buildFeed(likeCount: number, commentCount = 0): { pageParams: unknown[]; pages: PaginatedFeed[] } {
  return {
    pageParams: [undefined],
    pages: [
      {
        nextCursor: null,
        items: [
          {
            id: 'p1',
            authorId: 'u1',
            groupId: null,
            content: 'hello',
            visibility: 'public',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            media: [],
            author: {
              id: 'u1',
              displayName: 'User',
              avatarUrl: null,
            },
            stats: {
              likeCount,
              commentCount,
            },
          },
        ],
      },
    ],
  };
}

describe('engagement cache helpers', () => {
  it('applies optimistic like increment when post was not liked', () => {
    const current = buildFeed(4);
    const result = applyOptimisticLikeToFeed(current, {
      postId: 'p1',
      likedByMeBefore: false,
    });

    expect(result.nextLikedByMe).toBe(true);
    expect(result.nextFeed?.pages[0].items[0].stats.likeCount).toBe(5);
  });

  it('applies optimistic unlike decrement and floors at zero', () => {
    const current = buildFeed(0);
    const result = applyOptimisticLikeToFeed(current, {
      postId: 'p1',
      likedByMeBefore: true,
    });

    expect(result.nextLikedByMe).toBe(false);
    expect(result.nextFeed?.pages[0].items[0].stats.likeCount).toBe(0);
  });

  it('reconciles like count with backend result', () => {
    const current = buildFeed(2);
    const next = reconcileLikeCountInFeed(current, {
      postId: 'p1',
      likeCount: 9,
    });

    expect(next?.pages[0].items[0].stats.likeCount).toBe(9);
  });

  it('adjusts comment count with floor at zero', () => {
    const current = buildFeed(0, 1);
    const afterIncrement = adjustCommentCountInFeed(current, {
      postId: 'p1',
      delta: 1,
    });
    const afterDecrement = adjustCommentCountInFeed(afterIncrement, {
      postId: 'p1',
      delta: -3,
    });

    expect(afterIncrement?.pages[0].items[0].stats.commentCount).toBe(2);
    expect(afterDecrement?.pages[0].items[0].stats.commentCount).toBe(0);
  });
});
