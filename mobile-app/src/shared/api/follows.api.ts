import { requestJson } from './http';

export interface FollowRelationship {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

export interface FollowUserItem {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  followedAt: string;
}

export interface PaginatedFollowUsers {
  items: FollowUserItem[];
  nextCursor: string | null;
}

export function getRelationship(userId: string) {
  return requestJson<FollowRelationship>(`/follows/${userId}/status`);
}

export function followUser(userId: string) {
  return requestJson<{ isFollowing: true }>(`/follows/${userId}`, {
    method: 'POST',
  });
}

export function unfollowUser(userId: string) {
  return requestJson<{ isFollowing: false }>(`/follows/${userId}`, {
    method: 'DELETE',
  });
}

export function listFollowers(userId: string, params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedFollowUsers>(`/follows/${userId}/followers?${search.toString()}`);
}

export function listFollowing(userId: string, params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedFollowUsers>(`/follows/${userId}/following?${search.toString()}`);
}
