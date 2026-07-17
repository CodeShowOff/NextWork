import { requestJson } from './http';

export interface CommentItem {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  editedAt?: string | null;
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

export function updateComment(commentId: string, body: string) {
  return requestJson<CommentItem>(`/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) });
}

export function reportComment(commentId: string, reason: 'abuse' | 'harassment' | 'spam' | 'hate' | 'other', details?: string) {
  return requestJson<{ status: 'reported' | 'already_reported'; reportId?: string }>(`/comments/${commentId}/report`, { method: 'POST', body: JSON.stringify({ reason, ...(details ? { details } : {}) }) });
}

export interface CommentReport {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; displayName: string; avatarUrl: string | null };
  comment: { id: string; postId: string; body: string; moderationState: string; authorId: string };
}

export function listCommentReports(params: { limit?: number; status?: 'open' | 'resolved' | 'all' } = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.status) search.set('status', params.status);
  return requestJson<{ items: CommentReport[]; nextCursor: string | null }>(`/comments/reports?${search.toString()}`);
}

export function resolveCommentReport(reportId: string, action: 'dismiss' | 'remove_comment', note?: string) {
  return requestJson<{ status: 'ok' }>(`/comments/reports/${reportId}/resolve`, { method: 'POST', body: JSON.stringify({ action, ...(note ? { note } : {}) }) });
}
