import { requestJson } from './http';

export interface FeedPostMedia {
  id: string;
  url: string;
  type: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface FeedPost {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  media: FeedPostMedia[];
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  stats: {
    likeCount: number;
    commentCount: number;
  };
}

export interface PaginatedFeed {
  items: FeedPost[];
  nextCursor: string | null;
}

export function listFeed(params: { limit: number; before?: string; groupId?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }
  if (params.groupId) {
    search.set('groupId', params.groupId);
  }

  return requestJson<PaginatedFeed>(`/feed?${search.toString()}`);
}

export function createPost(payload: {
  content: string;
  visibility?: 'public' | 'followers' | 'private';
  groupId?: string;
  media?: {
    url: string;
    type: string;
    width?: number;
    height?: number;
  }[];
}) {
  return requestJson<FeedPost>('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
