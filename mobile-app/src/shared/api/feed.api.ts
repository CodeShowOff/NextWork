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
  taggedUserIds: string[];
  hashtags: string[];
  poll: {
    question: string;
    options: Array<{
      id: string;
      text: string;
      voteCount: number;
    }>;
    totalVotes: number;
    votedOptionId: string | null;
  } | null;
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

export interface PostShareLink {
  postId: string;
  shareUrl: string;
  appUrl: string;
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
  taggedUserIds?: string[];
  poll?: {
    question: string;
    options: Array<{
      text: string;
    }>;
  };
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

export function updatePost(
  postId: string,
  payload: {
    content?: string;
    visibility?: 'public' | 'followers' | 'private';
  },
) {
  return requestJson<FeedPost>(`/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deletePost(postId: string) {
  return requestJson<{ status: 'ok' }>(`/posts/${postId}`, {
    method: 'DELETE',
  });
}

export function getPostShareLink(postId: string) {
  return requestJson<PostShareLink>(`/posts/${postId}/share-link`);
}

export function votePostPoll(postId: string, optionId: string) {
  return requestJson<FeedPost>(`/posts/${postId}/poll/vote`, {
    method: 'POST',
    body: JSON.stringify({ optionId }),
  });
}
