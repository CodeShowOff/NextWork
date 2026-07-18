import type {
  CreatePostRequestDto,
  FeedPostDto,
  PaginatedFeedDto,
  PostShareLinkDto,
  UpdatePostRequestDto,
} from '@nextwork/api-contracts';

import { nextworkApi } from './contracts-client';

export type FeedPost = FeedPostDto;
export type PaginatedFeed = PaginatedFeedDto;
export type PostShareLink = PostShareLinkDto;

export function listFeed(params: { limit: number; before?: string; groupId?: string }) {
  return nextworkApi.feed.list(params);
}

export function createPost(payload: CreatePostRequestDto) {
  return nextworkApi.posts.create(payload);
}

export function updatePost(postId: string, payload: UpdatePostRequestDto) {
  return nextworkApi.posts.update(postId, payload);
}

export function deletePost(postId: string) {
  return nextworkApi.posts.delete(postId);
}

export function getPost(postId: string) {
  return nextworkApi.posts.get(postId);
}

export function getPostShareLink(postId: string) {
  return nextworkApi.posts.getShareLink(postId);
}

export function votePostPoll(postId: string, optionId: string) {
  return nextworkApi.posts.votePoll(postId, { optionId });
}
