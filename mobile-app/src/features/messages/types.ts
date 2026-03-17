export interface Participant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

export interface MessageAttachment {
  attachmentId: string;
  mediaType: 'image' | 'video' | 'document';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'application/pdf';
  fileName: string;
  fileSizeBytes: number;
  storageKey: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbnailKey: string | null;
}

export interface MessageReactionSummary {
  reactionType: 'thumbsup' | 'heart' | 'laughing' | 'astonished' | 'cry' | 'angry';
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: string;
  attachments: MessageAttachment[];
  reactions: MessageReactionSummary[];
  createdAt: string;
  editedAt: string | null;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Conversation {
  id: string;
  type: string;
  createdAt: string;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface MessageReadEvent {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}

export interface ConversationMessageEvent {
  conversationId: string;
  message: Message;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
}

export interface MessageAttachmentLifecycleEvent {
  conversationId: string;
  participantIds: string[];
  actorId: string;
  messageId?: string;
  eventId: string;
  serverTimestamp: string;
  attachments?: MessageAttachment[];
  reason?: string;
}

export interface MessageReactionUpdatedEvent {
  conversationId: string;
  participantIds: string[];
  actorId: string;
  messageId: string;
  reactions: Array<{
    reactionType: MessageReactionSummary['reactionType'];
    count: number;
  }>;
  eventId: string;
  serverTimestamp: string;
}
