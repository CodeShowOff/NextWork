import { requestJson } from './http';

export interface SearchUserItem {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

export interface SearchGroupItem {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
}

export interface SearchPostItem {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  createdAt: string;
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
}

export function searchAll(params: { query: string; limit?: number }) {
  const search = new URLSearchParams({ q: params.query.trim() });
  if (params.limit) {
    search.set('limit', String(params.limit));
  }

  return requestJson<SearchResponse>(`/search?${search.toString()}`);
}
