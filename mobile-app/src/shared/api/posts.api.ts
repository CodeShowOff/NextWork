import { requestJson } from './http';

export interface PostItem {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
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

export interface PaginatedPosts {
  items: PostItem[];
  nextCursor: string | null;
}

export function listMyPosts(params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedPosts>(`/posts/me?${search.toString()}`);
}

export function listUserPosts(userId: string, params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedPosts>(`/posts/user/${userId}?${search.toString()}`);
}
