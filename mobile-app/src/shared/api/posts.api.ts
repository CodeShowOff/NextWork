import type { PaginatedPostsDto } from '@nextwork/api-contracts';

import { nextworkApi } from './contracts-client';

export type PostItem = PaginatedPostsDto['items'][number];
export type PaginatedPosts = PaginatedPostsDto;

export function listMyPosts(params: { limit: number; before?: string }) {
  return nextworkApi.posts.listMine(params);
}

export function listUserPosts(userId: string, params: { limit: number; before?: string }) {
  return nextworkApi.posts.listByUser(userId, params);
}
