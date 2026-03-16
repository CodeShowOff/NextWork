import { requestJson } from './http';

export interface CommentItem {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  stats: {
    replyCount: number;
  };
}

export interface PaginatedComments {
  items: CommentItem[];
  nextCursor: string | null;
}

export function listComments(postId: string, params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedComments>(`/comments/posts/${postId}?${search.toString()}`);
}

export function createComment(payload: { postId: string; body: string; parentCommentId?: string }) {
  return requestJson<CommentItem>(`/comments/posts/${payload.postId}`, {
    method: 'POST',
    body: JSON.stringify({
      body: payload.body,
      ...(payload.parentCommentId ? { parentCommentId: payload.parentCommentId } : {}),
    }),
  });
}

export function deleteComment(commentId: string) {
  return requestJson<{ deleted: true }>(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}
