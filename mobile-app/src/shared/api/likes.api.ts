import { requestJson } from './http';

export interface LikeState {
  postId: string;
  likedByMe: boolean;
  likeCount: number;
}

export interface LikeMutationResult {
  liked: boolean;
  likeCount: number;
}

export interface LikersResponse {
  items: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    likedAt: string;
  }>;
  nextCursor: string | null;
}

export function getLikeState(postId: string) {
  return requestJson<LikeState>(`/likes/posts/${postId}`);
}

export function likePost(postId: string) {
  return requestJson<LikeMutationResult>(`/likes/posts/${postId}`, {
    method: 'POST',
  });
}

export function unlikePost(postId: string) {
  return requestJson<LikeMutationResult>(`/likes/posts/${postId}`, {
    method: 'DELETE',
  });
}

export function listLikers(postId: string, params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<LikersResponse>(`/likes/posts/${postId}/users?${search.toString()}`);
}
