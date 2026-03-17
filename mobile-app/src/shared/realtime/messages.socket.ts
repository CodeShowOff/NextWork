import { io, Socket } from 'socket.io-client';

import { useSessionStore } from '../session/session.store';
import {
  ConversationMessageEvent,
  Message,
  MessageAttachmentLifecycleEvent,
  MessageReactionUpdatedEvent,
  MessageReadEvent,
  TypingEvent,
} from '../../features/messages/types';

type RealtimeHandlers = {
  onNewMessage?: (message: Message) => void;
  onConversationMessage?: (event: ConversationMessageEvent) => void;
  onConversationMessageEdited?: (event: ConversationMessageEvent) => void;
  onMessageEdited?: (message: Message) => void;
  onAttachmentUploaded?: (event: MessageAttachmentLifecycleEvent) => void;
  onAttachmentFailed?: (event: MessageAttachmentLifecycleEvent) => void;
  onReactionUpdated?: (event: MessageReactionUpdatedEvent) => void;
  onRead?: (event: MessageReadEvent) => void;
  onTypingStart?: (event: TypingEvent) => void;
  onTypingStop?: (event: TypingEvent) => void;
};

let socket: Socket | null = null;

export function connectMessagesSocket(handlers: RealtimeHandlers): Socket {
  const state = useSessionStore.getState();

  if (!socket) {
    socket = io(state.realtimeBaseUrl, {
      transports: ['websocket'],
      auth: {
        token: state.accessToken,
      },
      autoConnect: true,
      forceNew: true,
    });
  }

  if (handlers.onNewMessage) {
    socket.on('message.new', handlers.onNewMessage);
  }

  if (handlers.onConversationMessage) {
    socket.on('conversation.message', handlers.onConversationMessage);
  }

  if (handlers.onConversationMessageEdited) {
    socket.on('conversation.message_edited', handlers.onConversationMessageEdited);
  }

  if (handlers.onMessageEdited) {
    socket.on('message.edited', handlers.onMessageEdited);
  }

  if (handlers.onAttachmentUploaded) {
    socket.on('message.attachment.uploaded', handlers.onAttachmentUploaded);
  }

  if (handlers.onAttachmentFailed) {
    socket.on('message.attachment.failed', handlers.onAttachmentFailed);
  }

  if (handlers.onReactionUpdated) {
    socket.on('message.reaction.updated', handlers.onReactionUpdated);
  }

  if (handlers.onRead) {
    socket.on('message.read', handlers.onRead);
    socket.on('conversation.read', handlers.onRead);
  }

  if (handlers.onTypingStart) {
    socket.on('typing.start', handlers.onTypingStart);
  }

  if (handlers.onTypingStop) {
    socket.on('typing.stop', handlers.onTypingStop);
  }

  return socket;
}

export function getMessagesSocket(): Socket | null {
  return socket;
}

export function disconnectMessagesSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
