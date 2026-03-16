import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ConversationWithRelations,
  MessageWithSender,
  MessagesRepository,
} from './messages.repository';

export interface ConversationParticipantView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

export interface MessageView {
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

export interface ConversationView {
  id: string;
  type: string;
  createdAt: string;
  participants: ConversationParticipantView[];
  lastMessage: MessageView | null;
  unreadCount: number;
}

export interface PaginatedConversationsResponse {
  items: ConversationView[];
  nextCursor: string | null;
}

export interface PaginatedMessagesResponse {
  items: MessageView[];
  nextCursor: string | null;
}

interface MessageCreatedEvent {
  conversationId: string;
  participantIds: string[];
  message: MessageView;
}

interface MessageReadEvent {
  conversationId: string;
  participantIds: string[];
  userId: string;
  lastReadMessageId: string;
}

@Injectable()
export class MessagesService {
  private readonly newMessageChannel = 'messages:new';
  private readonly readMessageChannel = 'messages:read';

  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  async createConversation(userId: string, payload: CreateConversationDto): Promise<ConversationView> {
    const type = payload.type ?? 'direct';
    const participantIds = this.normalizeParticipantIds(userId, payload.participantIds);

    if (type === 'direct' && participantIds.length !== 2) {
      throw new BadRequestException('Direct conversations must have exactly two participants.');
    }

    const existingUsers = await this.messagesRepository.countUsersByIds(participantIds);
    if (existingUsers !== participantIds.length) {
      throw new BadRequestException('One or more participants do not exist.');
    }

    if (type === 'direct') {
      const otherParticipantId = participantIds.find((id) => id !== userId);
      if (!otherParticipantId) {
        throw new BadRequestException('A direct conversation requires another participant.');
      }

      const existingConversation = await this.messagesRepository.findDirectConversationBetweenUsers(
        userId,
        otherParticipantId,
      );

      if (existingConversation && existingConversation.participants.length === 2) {
        return this.toConversationView(existingConversation, userId);
      }
    }

    const conversation = await this.messagesRepository.createConversation({
      createdBy: userId,
      type,
      participantIds,
    });

    await Promise.all(participantIds.map((participantId) => this.invalidateConversationCache(participantId)));

    return this.toConversationView(conversation, userId);
  }

  async listConversations(
    userId: string,
    query: ListConversationsQueryDto,
  ): Promise<PaginatedConversationsResponse> {
    const cacheKey = `conversation-summary:${userId}:limit=${query.limit ?? 20}:before=${query.before ?? 'none'}`;
    const cached = await this.cacheService.getJson<PaginatedConversationsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const pageSize = query.limit ?? 20;
    const take = pageSize + 1;
    const before = query.before ? new Date(query.before) : undefined;

    const conversations = await this.messagesRepository.listConversationsForUser({
      userId,
      before,
      take,
    });

    const hasMore = conversations.length > pageSize;
    const pageItems = hasMore ? conversations.slice(0, pageSize) : conversations;

    const items = await Promise.all(
      pageItems.map(async (conversation) => this.toConversationView(conversation, userId)),
    );

    const response = {
      items,
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.createdAt.toISOString() ?? null : null,
    };

    await this.cacheService.setJson(cacheKey, response, 20);
    return response;
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponse> {
    await this.ensureParticipant(conversationId, userId);

    const pageSize = query.limit ?? 30;
    const take = pageSize + 1;
    const before = query.before ? new Date(query.before) : undefined;

    const messages = await this.messagesRepository.listMessagesForConversation({
      conversationId,
      userId,
      before,
      take,
    });

    const hasMore = messages.length > pageSize;
    const pageItems = hasMore ? messages.slice(0, pageSize) : messages;

    return {
      items: pageItems.map((message) => this.toMessageView(message)),
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  async sendMessage(userId: string, conversationId: string, payload: SendMessageDto): Promise<MessageView> {
    await this.ensureParticipant(conversationId, userId);

    const message = await this.messagesRepository.createMessage({
      conversationId,
      senderId: userId,
      body: payload.body.trim(),
      messageType: payload.messageType ?? 'text',
    });

    const messageView = this.toMessageView(message);
    const participantIds = (await this.messagesRepository.listParticipantIds(conversationId)).map(
      (item) => item.userId,
    );

    const eventPayload: MessageCreatedEvent = {
      conversationId,
      participantIds,
      message: messageView,
    };

    await Promise.all(
      participantIds
        .filter((participantId) => participantId !== userId)
        .map((participantId) =>
          this.notificationsService.createNotification({
            userId: participantId,
            actorId: userId,
            type: 'message',
            entityType: 'conversation',
            entityId: conversationId,
          }),
        ),
    );

    await this.redisService.getClient().publish(this.newMessageChannel, JSON.stringify(eventPayload));
    await Promise.all(participantIds.map((participantId) => this.invalidateConversationCache(participantId)));

    return messageView;
  }

  async markConversationRead(
    userId: string,
    conversationId: string,
    lastReadMessageId: string,
  ): Promise<void> {
    await this.ensureParticipant(conversationId, userId);

    const message = await this.messagesRepository.findMessageInConversation(lastReadMessageId, conversationId);
    if (!message) {
      throw new NotFoundException('Message not found in this conversation.');
    }

    await this.messagesRepository.markConversationRead({
      conversationId,
      userId,
      lastReadMessageId,
    });

    const participantIds = (await this.messagesRepository.listParticipantIds(conversationId)).map(
      (item) => item.userId,
    );

    const eventPayload: MessageReadEvent = {
      conversationId,
      participantIds,
      userId,
      lastReadMessageId,
    };

    await this.redisService.getClient().publish(this.readMessageChannel, JSON.stringify(eventPayload));
    await Promise.all(participantIds.map((participantId) => this.invalidateConversationCache(participantId)));
  }

  async assertParticipant(conversationId: string, userId: string): Promise<void> {
    await this.ensureParticipant(conversationId, userId);
  }

  getMessageChannelName(): string {
    return this.newMessageChannel;
  }

  getReadChannelName(): string {
    return this.readMessageChannel;
  }

  private normalizeParticipantIds(userId: string, participantIds: string[]): string[] {
    const deduped = new Set<string>(participantIds.filter(Boolean));
    deduped.add(userId);
    return [...deduped];
  }

  private async ensureParticipant(conversationId: string, userId: string): Promise<void> {
    const isParticipant = await this.messagesRepository.assertParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }
  }

  private async toConversationView(
    conversation: ConversationWithRelations,
    viewerId: string,
  ): Promise<ConversationView> {
    const viewerParticipant = conversation.participants.find((participant) => participant.userId === viewerId);

    const unreadCount = await this.messagesRepository.countUnreadMessages({
      conversationId: conversation.id,
      userId: viewerId,
      lastReadMessageId: viewerParticipant?.lastReadMessageId ?? null,
    });

    return {
      id: conversation.id,
      type: conversation.type,
      createdAt: conversation.createdAt.toISOString(),
      participants: conversation.participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.user.profile?.displayName ?? 'Unknown',
        avatarUrl: participant.user.profile?.avatarUrl ?? null,
        role: participant.role,
      })),
      lastMessage: conversation.messages[0] ? this.toMessageView(conversation.messages[0]) : null,
      unreadCount,
    };
  }

  private toMessageView(message: MessageWithSender): MessageView {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      messageType: message.messageType,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt ? message.editedAt.toISOString() : null,
      sender: {
        id: message.sender.id,
        displayName: message.sender.profile?.displayName ?? 'Unknown',
        avatarUrl: message.sender.profile?.avatarUrl ?? null,
      },
    };
  }

  private async invalidateConversationCache(userId: string): Promise<void> {
    await this.cacheService.deleteByPrefix(`conversation-summary:${userId}:`);
  }
}
