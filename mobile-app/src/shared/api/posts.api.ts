import type { PaginatedPostsDto } from '@workplace/api-contracts';

import { workplaceApi } from './contracts-client';

export type PostItem = PaginatedPostsDto['items'][number];
export type PaginatedPosts = PaginatedPostsDto;

export function listMyPosts(params: { limit: number; before?: string }) {
  return workplaceApi.posts.listMine(params);
}

export function listUserPosts(userId: string, params: { limit: number; before?: string }) {
  return workplaceApi.posts.listByUser(userId, params);
}
