import { requestJson } from './http';

export interface SearchUserItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  relevanceScore: number;
}

export interface SearchGroupItem {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  relevanceScore: number;
}

export interface SearchPostItem {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  createdAt: string;
  relevanceScore: number;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface SearchResponse {
  query: string;
  users: SearchUserItem[];
  groups: SearchGroupItem[];
  posts: SearchPostItem[];
  pageInfo: {
    usersNextCursor: string | null;
    groupsNextCursor: string | null;
    postsNextCursor: string | null;
  };
}

export function searchAll(params: {
  query: string;
  limit?: number;
  usersCursor?: string;
  groupsCursor?: string;
  postsCursor?: string;
  scope?: 'all' | 'users' | 'groups' | 'posts';
}) {
  const search = new URLSearchParams({ q: params.query.trim() });
  if (params.limit) {
    search.set('limit', String(params.limit));
  }
  if (params.usersCursor) {
    search.set('usersCursor', params.usersCursor);
  }
  if (params.groupsCursor) {
    search.set('groupsCursor', params.groupsCursor);
  }
  if (params.postsCursor) {
    search.set('postsCursor', params.postsCursor);
  }
  if (params.scope) {
    search.set('scope', params.scope);
  }

  return requestJson<SearchResponse>(`/search?${search.toString()}`);
}
