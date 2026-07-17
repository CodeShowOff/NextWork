import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CacheService } from '../../common/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../../common/redis/redis.service';
import { MediaService } from '../media/media.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { MessageAttachmentDto } from './dto/send-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ALLOWED_REACTION_TYPES, UpsertMessageReactionDto } from './dto/upsert-message-reaction.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
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
  attachments: MessageAttachmentView[];
  reactions: MessageReactionSummaryView[];
  createdAt: string;
  editedAt: string | null;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface MessageReactionSummaryView {
  reactionType: string;
  count: number;
  reactedByMe: boolean;
}

export interface MessageAttachmentView {
  attachmentId: string;
  mediaId: string | null;
  mediaType: string;
  mimeType: string;
  fileName: string;
  fileSizeBytes: number;
  storageKey: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbnailKey: string | null;
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

interface MessageEditedEvent {
  conversationId: string;
  participantIds: string[];
  message: MessageView;
}

interface MessageReactionUpdatedEvent {
  conversationId: string;
  participantIds: string[];
  actorId: string;
  messageId: string;
  reactions: Array<{
    reactionType: string;
    count: number;
  }>;
  eventId: string;
  serverTimestamp: string;
}

interface MessageAttachmentLifecycleEvent {
  conversationId: string;
  participantIds: string[];
  actorId: string;
  messageId?: string;
  eventId: string;
  serverTimestamp: string;
  attachments?: MessageAttachmentView[];
  reason?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_BYTES_BY_MIME: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'video/mp4': 25 * 1024 * 1024,
  'application/pdf': 15 * 1024 * 1024,
};
const ALLOWED_REACTION_TYPE_SET = new Set<string>(ALLOWED_REACTION_TYPES);

@Injectable()
export class MessagesService {
  private readonly newMessageChannel = 'messages:new';
  private readonly readMessageChannel = 'messages:read';
  private readonly editedMessageChannel = 'messages:edited';
  private readonly reactionUpdatedChannel = 'messages:reaction-updated';
  private readonly attachmentUploadedChannel = 'messages:attachment-uploaded';
  private readonly attachmentFailedChannel = 'messages:attachment-failed';

  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
    private readonly mediaService: MediaService,
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

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.messagesRepository.countUnreadMessagesForUser(userId);
    return { unreadCount };
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
      items: pageItems.map((message) => this.toMessageView(message, userId)),
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  async sendMessage(userId: string, conversationId: string, payload: SendMessageDto): Promise<MessageView> {
    await this.ensureParticipant(conversationId, userId);

    const participantIds = (await this.messagesRepository.listParticipantIds(conversationId)).map(
      (item) => item.userId,
    );

    const normalizedBody = payload.body?.trim() ?? '';
    if (!normalizedBody && !payload.attachments?.length) {
      throw new BadRequestException('Message body is required when no attachments are provided.');
    }

    let normalizedAttachments: MessageAttachmentView[];
    try {
      normalizedAttachments = await this.normalizeAndValidateAttachments(userId, payload.attachments ?? []);
    } catch (error) {
      await this.publishAttachmentLifecycle(this.attachmentFailedChannel, {
        conversationId,
        participantIds,
        actorId: userId,
        reason: (error as Error).message,
      });
      throw error;
    }

    const message = await this.messagesRepository.createMessage({
      conversationId,
      senderId: userId,
      body: normalizedBody,
      messageType: payload.messageType ?? (normalizedAttachments.length ? 'attachment' : 'text'),
      ...(normalizedAttachments.length ? { attachments: normalizedAttachments } : {}),
    });

    const messageView = this.toMessageView(message, userId);

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

    if (messageView.attachments.length) {
      await this.publishAttachmentLifecycle(this.attachmentUploadedChannel, {
        conversationId,
        participantIds,
        actorId: userId,
        messageId: messageView.id,
        attachments: messageView.attachments,
      });
    }

    await Promise.all(participantIds.map((participantId) => this.invalidateConversationCache(participantId)));

    return messageView;
  }

  async updateMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    payload: UpdateMessageDto,
  ): Promise<MessageView> {
    await this.ensureParticipant(conversationId, userId);

    const existing = await this.messagesRepository.findMessageForConversation(messageId, conversationId);
    if (!existing) {
      throw new NotFoundException('Message not found in this conversation.');
    }

    if (existing.senderId !== userId) {
      throw new ForbiddenException('Only the sender can edit this message.');
    }

    const nextBody = payload.body.trim();
    if (!nextBody) {
      throw new BadRequestException('Message body is required.');
    }

    const updated = await this.messagesRepository.updateMessageBody(messageId, nextBody);

    const messageView = this.toMessageView(updated, userId);
    const participantIds = (await this.messagesRepository.listParticipantIds(conversationId)).map(
      (item) => item.userId,
    );

    const eventPayload: MessageEditedEvent = {
      conversationId,
      participantIds,
      message: messageView,
    };

    await this.redisService.getClient().publish(this.editedMessageChannel, JSON.stringify(eventPayload));
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

  async upsertMessageReaction(
    userId: string,
    messageId: string,
    payload: UpsertMessageReactionDto,
  ): Promise<{ messageId: string; reactions: MessageReactionSummaryView[] }> {
    const message = await this.messagesRepository.findMessageById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    await this.ensureParticipant(message.conversationId, userId);

    if (!ALLOWED_REACTION_TYPE_SET.has(payload.reactionType)) {
      throw new BadRequestException('Unsupported reaction type.');
    }

    await this.messagesRepository.upsertReaction({
      messageId,
      userId,
      reactionType: payload.reactionType,
    });

    const reactions = await this.buildReactionSummary(messageId, userId);
    const participantIds = (await this.messagesRepository.listParticipantIds(message.conversationId)).map(
      (item) => item.userId,
    );

    await this.publishReactionUpdated({
      conversationId: message.conversationId,
      participantIds,
      actorId: userId,
      messageId,
      reactions: reactions.map((reaction) => ({
        reactionType: reaction.reactionType,
        count: reaction.count,
      })),
    });

    return { messageId, reactions };
  }

  async removeMessageReaction(
    userId: string,
    messageId: string,
    reactionType?: string,
  ): Promise<{ messageId: string; reactions: MessageReactionSummaryView[] }> {
    const message = await this.messagesRepository.findMessageById(messageId);
    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    await this.ensureParticipant(message.conversationId, userId);

    if (reactionType && !ALLOWED_REACTION_TYPE_SET.has(reactionType)) {
      throw new BadRequestException('Unsupported reaction type.');
    }

    await this.messagesRepository.removeReaction({
      messageId,
      userId,
      ...(reactionType ? { reactionType } : {}),
    });

    const reactions = await this.buildReactionSummary(messageId, userId);
    const participantIds = (await this.messagesRepository.listParticipantIds(message.conversationId)).map(
      (item) => item.userId,
    );

    await this.publishReactionUpdated({
      conversationId: message.conversationId,
      participantIds,
      actorId: userId,
      messageId,
      reactions: reactions.map((reaction) => ({
        reactionType: reaction.reactionType,
        count: reaction.count,
      })),
    });

    return { messageId, reactions };
  }

  getMessageChannelName(): string {
    return this.newMessageChannel;
  }

  getReadChannelName(): string {
    return this.readMessageChannel;
  }

  getEditChannelName(): string {
    return this.editedMessageChannel;
  }

  getReactionUpdatedChannelName(): string {
    return this.reactionUpdatedChannel;
  }

  getAttachmentUploadedChannelName(): string {
    return this.attachmentUploadedChannel;
  }

  getAttachmentFailedChannelName(): string {
    return this.attachmentFailedChannel;
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
      lastMessage: conversation.messages[0] ? this.toMessageView(conversation.messages[0], viewerId) : null,
      unreadCount,
    };
  }

  private toMessageView(message: MessageWithSender, viewerId: string): MessageView {
    const reactionsByType = new Map<string, Set<string>>();
    for (const reaction of message.reactions) {
      const users = reactionsByType.get(reaction.reactionType) ?? new Set<string>();
      users.add(reaction.userId);
      reactionsByType.set(reaction.reactionType, users);
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      messageType: message.messageType,
      attachments: message.attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        mediaId: attachment.mediaObjectId,
        mediaType: attachment.mediaType,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        fileSizeBytes: attachment.fileSizeBytes,
        storageKey: attachment.storageKey,
        publicUrl: attachment.publicUrl,
        width: attachment.width,
        height: attachment.height,
        durationMs: attachment.durationMs,
        thumbnailKey: attachment.thumbnailKey,
      })),
      reactions: [...reactionsByType.entries()].map(([reactionType, users]) => ({
        reactionType,
        count: users.size,
        reactedByMe: users.has(viewerId),
      })),
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

  private async normalizeAndValidateAttachments(userId: string, attachments: MessageAttachmentDto[]): Promise<MessageAttachmentView[]> {
    if (!attachments.length) {
      return [];
    }

    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new BadRequestException(`Attachments exceed maximum count of ${MAX_ATTACHMENTS_PER_MESSAGE}.`);
    }

    let totalBytes = 0;
    return Promise.all(attachments.map(async (attachment) => {
      if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
        throw new BadRequestException(`Unsupported attachment mime type: ${attachment.mimeType}`);
      }

      const maxPerMime = MAX_BYTES_BY_MIME[attachment.mimeType];
      if (!maxPerMime || attachment.fileSizeBytes > maxPerMime) {
        throw new BadRequestException(`Attachment exceeds allowed size for ${attachment.mimeType}.`);
      }

      totalBytes += attachment.fileSizeBytes;
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        throw new BadRequestException('Total attachment payload exceeds 50MB limit.');
      }

      if (attachment.mediaId) {
        const media = await this.mediaService.assertMediaObjectAvailableForMessage(userId, attachment.mediaId);
        if (
          media.storageKey !== attachment.storageKey ||
          media.originalFileName !== attachment.fileName ||
          media.contentType !== attachment.mimeType ||
          media.sizeBytes !== attachment.fileSizeBytes
        ) {
          throw new ForbiddenException('Attachment metadata does not match the scanned upload.');
        }
      } else if (!attachment.publicUrl || !this.mediaService.isPublicMediaUrlAllowed(userId, attachment.publicUrl)) {
        throw new ForbiddenException('Attachment URL is not allowed for this user.');
      }

      return {
        attachmentId: attachment.attachmentId ?? randomUUID(),
        mediaId: attachment.mediaId ?? null,
        mediaType: attachment.mediaType,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
        fileSizeBytes: attachment.fileSizeBytes,
        storageKey: attachment.storageKey,
        // A MediaObject is resolved through a scoped download URL when rendered.
        // Keep the legacy column non-null until its historical data is migrated.
        publicUrl: attachment.mediaId ? '' : attachment.publicUrl!,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        durationMs: attachment.durationMs ?? null,
        thumbnailKey: attachment.thumbnailKey ?? null,
      };
    }));
  }

  private async publishAttachmentLifecycle(
    channel: string,
    payload: Omit<MessageAttachmentLifecycleEvent, 'eventId' | 'serverTimestamp'>,
  ): Promise<void> {
    await this.redisService
      .getClient()
      .publish(
        channel,
        JSON.stringify({
          ...payload,
          eventId: randomUUID(),
          serverTimestamp: new Date().toISOString(),
        } satisfies MessageAttachmentLifecycleEvent),
      );
  }

  private async buildReactionSummary(
    messageId: string,
    viewerId: string,
  ): Promise<MessageReactionSummaryView[]> {
    const reactions = await this.messagesRepository.listMessageReactions(messageId);
    const byType = new Map<string, Set<string>>();

    for (const reaction of reactions) {
      const users = byType.get(reaction.reactionType) ?? new Set<string>();
      users.add(reaction.userId);
      byType.set(reaction.reactionType, users);
    }

    return [...byType.entries()].map(([reactionType, users]) => ({
      reactionType,
      count: users.size,
      reactedByMe: users.has(viewerId),
    }));
  }

  private async publishReactionUpdated(
    payload: Omit<MessageReactionUpdatedEvent, 'eventId' | 'serverTimestamp'>,
  ): Promise<void> {
    await this.redisService
      .getClient()
      .publish(
        this.reactionUpdatedChannel,
        JSON.stringify({
          ...payload,
          eventId: randomUUID(),
          serverTimestamp: new Date().toISOString(),
        } satisfies MessageReactionUpdatedEvent),
      );
  }
}
