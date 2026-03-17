import { Conversation, Message, PaginatedResponse } from '../../features/messages/types';
import { requestJson } from './http';

export interface SendMessageAttachmentPayload {
  attachmentId?: string;
  mediaType: 'image' | 'video' | 'document';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'application/pdf';
  fileName: string;
  fileSizeBytes: number;
  storageKey: string;
  publicUrl: string;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailKey?: string;
}

export type MessageReactionType = 'thumbsup' | 'heart' | 'laughing' | 'astonished' | 'cry' | 'angry';

export function listConversations(params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedResponse<Conversation>>(`/messages/conversations?${search.toString()}`);
}

export function getUnreadMessagesCount() {
  return requestJson<{ unreadCount: number }>('/messages/unread-count');
}

export function listMessages(conversationId: string, params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedResponse<Message>>(
    `/messages/conversations/${conversationId}/messages?${search.toString()}`,
  );
}

export function createConversation(payload: { type: 'direct' | 'group'; participantIds: string[] }) {
  return requestJson<Conversation>('/messages/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function sendMessage(
  conversationId: string,
  payload: { body?: string; messageType?: string; attachments?: SendMessageAttachmentPayload[] },
) {
  return requestJson<Message>(`/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMessage(conversationId: string, messageId: string, payload: { body: string }) {
  return requestJson<Message>(`/messages/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function markRead(conversationId: string, lastReadMessageId: string) {
  return requestJson<{ status: 'ok' }>(`/messages/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastReadMessageId }),
  });
}

export function addMessageReaction(messageId: string, reactionType: MessageReactionType) {
  return requestJson<{ messageId: string; reactions: Array<{ reactionType: MessageReactionType; count: number; reactedByMe: boolean }> }>(
    `/messages/${messageId}/reactions`,
    {
      method: 'PUT',
      body: JSON.stringify({ reactionType }),
    },
  );
}

export function removeMessageReaction(messageId: string, reactionType: MessageReactionType) {
  return requestJson<{ messageId: string; reactions: Array<{ reactionType: MessageReactionType; count: number; reactedByMe: boolean }> }>(
    `/messages/${messageId}/reactions/${reactionType}`,
    {
      method: 'DELETE',
    },
  );
}
