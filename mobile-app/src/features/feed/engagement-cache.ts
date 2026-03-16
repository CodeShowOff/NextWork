import { PaginatedFeed } from '../../shared/api/feed.api';

export interface OptimisticLikeResult {
  nextFeed: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined;
  nextLikedByMe: boolean;
}

export function applyOptimisticLikeToFeed(
  current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined,
  params: {
    postId: string;
    likedByMeBefore: boolean;
  },
): OptimisticLikeResult {
  const nextLikedByMe = !params.likedByMeBefore;

  if (!current) {
    return {
      nextFeed: current,
      nextLikedByMe,
    };
  }

  const delta = nextLikedByMe ? 1 : -1;
  return {
    nextLikedByMe,
    nextFeed: {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === params.postId
            ? {
                ...item,
                stats: {
                  ...item.stats,
                  likeCount: Math.max(0, item.stats.likeCount + delta),
                },
              }
            : item,
        ),
      })),
    },
  };
}

export function reconcileLikeCountInFeed(
  current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined,
  params: {
    postId: string;
    likeCount: number;
  },
): { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === params.postId
          ? {
              ...item,
              stats: {
                ...item.stats,
                likeCount: params.likeCount,
              },
            }
          : item,
      ),
    })),
  };
}

export function adjustCommentCountInFeed(
  current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined,
  params: {
    postId: string;
    delta: number;
  },
): { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === params.postId
          ? {
              ...item,
              stats: {
                ...item.stats,
                commentCount: Math.max(0, item.stats.commentCount + params.delta),
              },
            }
          : item,
      ),
    })),
  };
}
