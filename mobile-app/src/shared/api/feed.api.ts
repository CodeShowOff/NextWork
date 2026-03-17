import type {
  CreatePostRequestDto,
  FeedPostDto,
  PaginatedFeedDto,
  PostShareLinkDto,
  UpdatePostRequestDto,
} from '@workplace/api-contracts';

import { workplaceApi } from './contracts-client';

export type FeedPost = FeedPostDto;
export type PaginatedFeed = PaginatedFeedDto;
export type PostShareLink = PostShareLinkDto;

export function listFeed(params: { limit: number; before?: string; groupId?: string }) {
  return workplaceApi.feed.list(params);
}

export function createPost(payload: CreatePostRequestDto) {
  return workplaceApi.posts.create(payload);
}

export function updatePost(postId: string, payload: UpdatePostRequestDto) {
  return workplaceApi.posts.update(postId, payload);
}

export function deletePost(postId: string) {
  return workplaceApi.posts.delete(postId);
}

export function getPostShareLink(postId: string) {
  return workplaceApi.posts.getShareLink(postId);
}

export function votePostPoll(postId: string, optionId: string) {
  return workplaceApi.posts.votePoll(postId, { optionId });
}
