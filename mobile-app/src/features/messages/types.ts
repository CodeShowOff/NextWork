export interface Participant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: string;
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
