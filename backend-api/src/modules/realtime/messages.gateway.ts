import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Server, Socket } from 'socket.io';

import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { UsersService } from '../users/users.service';
import { SendMessageDto } from '../messages/dto/send-message.dto';
import { MessagesService } from '../messages/messages.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../../common/redis/redis.service';
import { RealtimeMetricsService } from '../../common/observability/realtime-metrics.service';

interface MessageCreatedEvent {
  conversationId: string;
  participantIds: string[];
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    messageType: string;
    attachments: Array<{
      attachmentId: string;
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
    }>;
    createdAt: string;
    editedAt: string | null;
    sender: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
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
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    messageType: string;
    attachments: Array<{
      attachmentId: string;
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
    }>;
    createdAt: string;
    editedAt: string | null;
    sender: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  };
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
  attachments?: Array<{
    attachmentId: string;
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
  }>;
  reason?: string;
}

interface NotificationCreatedEvent {
  userId: string;
  notification: {
    id: string;
    userId: string;
    actorId: string | null;
    type: string;
    entityType: string;
    entityId: string;
    isRead: boolean;
    createdAt: string;
    actor: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
}

interface NotificationReadEvent {
  userId: string;
  notificationId?: string;
  readAll?: boolean;
}

interface SocketWithUser extends Socket {
  data: Socket['data'] & {
    user?: JwtPayload;
  };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
@Injectable()
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);
  private readonly exportOnlyMode = process.env.OPENAPI_EXPORT_ONLY === 'true';
  private subscriber?: Redis;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
    private readonly realtimeMetricsService: RealtimeMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.exportOnlyMode) {
      return;
    }

    this.subscriber = this.redisService.getClient().duplicate();

    this.subscriber.on('error', (error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`);
    });

    await this.subscriber.subscribe(
      this.messagesService.getMessageChannelName(),
      this.messagesService.getReadChannelName(),
      this.messagesService.getEditChannelName(),
      this.messagesService.getReactionUpdatedChannelName(),
      this.messagesService.getAttachmentUploadedChannelName(),
      this.messagesService.getAttachmentFailedChannelName(),
      this.notificationsService.getNotificationCreatedChannel(),
      this.notificationsService.getNotificationReadChannel(),
    );
    this.subscriber.on('message', (channel, payload) => {
      if (channel === this.messagesService.getMessageChannelName()) {
        this.broadcastMessageEvent(payload);
        return;
      }

      if (channel === this.messagesService.getReadChannelName()) {
        this.broadcastReadEvent(payload);
        return;
      }

      if (channel === this.messagesService.getEditChannelName()) {
        this.broadcastMessageEditedEvent(payload);
        return;
      }

      if (channel === this.messagesService.getReactionUpdatedChannelName()) {
        this.broadcastMessageReactionUpdatedEvent(payload);
        return;
      }

      if (channel === this.messagesService.getAttachmentUploadedChannelName()) {
        this.broadcastAttachmentLifecycleEvent('message.attachment.uploaded', payload);
        return;
      }

      if (channel === this.messagesService.getAttachmentFailedChannelName()) {
        this.broadcastAttachmentLifecycleEvent('message.attachment.failed', payload);
        return;
      }

      if (channel === this.notificationsService.getNotificationCreatedChannel()) {
        this.broadcastNotificationEvent(payload);
        return;
      }

      if (channel === this.notificationsService.getNotificationReadChannel()) {
        this.broadcastNotificationReadEvent(payload);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  async handleConnection(client: SocketWithUser): Promise<void> {
    this.realtimeMetricsService.onConnectionOpen();

    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new WsException('Missing auth token');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new WsException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== 'active') {
        throw new WsException('Inactive user');
      }

      client.data.user = payload;
      this.realtimeMetricsService.onAuthenticatedConnection();
      await client.join(this.userRoom(payload.sub));
    } catch (error) {
      this.realtimeMetricsService.onAuthenticationFailed();
      this.logger.warn(`Socket auth failed for ${client.id}: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: SocketWithUser): void {
    this.realtimeMetricsService.onConnectionClose({ wasAuthenticated: Boolean(client.data.user) });
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_conversation')
  async joinConversation(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<{ conversationId: string; status: 'joined' }> {
    const user = this.getSocketUser(client);
    const conversationId = payload?.conversationId;

    if (!conversationId) {
      throw new WsException('conversationId is required');
    }

    await this.messagesService.assertParticipant(conversationId, user.sub);
    await client.join(this.conversationRoom(conversationId));

    return { conversationId, status: 'joined' };
  }

  @SubscribeMessage('leave_conversation')
  async leaveConversation(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<{ conversationId: string; status: 'left' }> {
    const user = this.getSocketUser(client);
    const conversationId = payload?.conversationId;

    if (!conversationId) {
      throw new WsException('conversationId is required');
    }

    await this.messagesService.assertParticipant(conversationId, user.sub);
    await client.leave(this.conversationRoom(conversationId));

    return { conversationId, status: 'left' };
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody()
    payload: {
      conversationId?: string;
      body?: string;
      messageType?: string;
      attachments?: SendMessageDto['attachments'];
    },
  ): Promise<{ status: 'sent'; messageId: string }> {
    const user = this.getSocketUser(client);

    if (!payload?.conversationId) {
      throw new WsException('conversationId is required');
    }

    if ((!payload?.body || !payload.body.trim()) && !payload?.attachments?.length) {
      throw new WsException('body is required when attachments are missing');
    }

    const messagePayload: SendMessageDto = {
      ...(payload.body ? { body: payload.body } : {}),
      ...(payload.messageType ? { messageType: payload.messageType } : {}),
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
    };

    const message = await this.messagesService.sendMessage(user.sub, payload.conversationId, messagePayload);
    this.realtimeMetricsService.onMessageSent();
    return {
      status: 'sent',
      messageId: message.id,
    };
  }

  @SubscribeMessage('mark_read')
  async markRead(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { conversationId?: string; lastReadMessageId?: string },
  ): Promise<{ status: 'ok'; conversationId: string }> {
    const user = this.getSocketUser(client);

    if (!payload?.conversationId || !payload?.lastReadMessageId) {
      throw new WsException('conversationId and lastReadMessageId are required');
    }

    await this.messagesService.markConversationRead(
      user.sub,
      payload.conversationId,
      payload.lastReadMessageId,
    );

    return {
      status: 'ok',
      conversationId: payload.conversationId,
    };
  }

  @SubscribeMessage('typing_start')
  async typingStart(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<{ status: 'ok' }> {
    const user = this.getSocketUser(client);

    if (!payload?.conversationId) {
      throw new WsException('conversationId is required');
    }

    await this.messagesService.assertParticipant(payload.conversationId, user.sub);
    this.realtimeMetricsService.onTypingEvent();
    this.server.to(this.conversationRoom(payload.conversationId)).emit('typing.start', {
      conversationId: payload.conversationId,
      userId: user.sub,
    });

    return { status: 'ok' };
  }

  @SubscribeMessage('typing_stop')
  async typingStop(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { conversationId?: string },
  ): Promise<{ status: 'ok' }> {
    const user = this.getSocketUser(client);

    if (!payload?.conversationId) {
      throw new WsException('conversationId is required');
    }

    await this.messagesService.assertParticipant(payload.conversationId, user.sub);
    this.realtimeMetricsService.onTypingEvent();
    this.server.to(this.conversationRoom(payload.conversationId)).emit('typing.stop', {
      conversationId: payload.conversationId,
      userId: user.sub,
    });

    return { status: 'ok' };
  }

  private getSocketUser(client: SocketWithUser): JwtPayload {
    if (!client.data.user) {
      throw new WsException('Unauthorized');
    }

    return client.data.user;
  }

  private extractToken(client: SocketWithUser): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }

  private broadcastMessageEvent(payload: string): void {
    try {
      const event = JSON.parse(payload) as MessageCreatedEvent;
      const roomName = this.conversationRoom(event.conversationId);

      this.server.to(roomName).emit('message.new', event.message);
      for (const participantId of event.participantIds) {
        this.server
          .to(this.userRoom(participantId))
          .emit('conversation.message', { conversationId: event.conversationId, message: event.message });
      }
    } catch (error) {
      this.logger.error(`Failed to parse message event: ${(error as Error).message}`);
    }
  }

  private broadcastReadEvent(payload: string): void {
    try {
      const event = JSON.parse(payload) as MessageReadEvent;
      const roomName = this.conversationRoom(event.conversationId);

      this.server.to(roomName).emit('message.read', {
        conversationId: event.conversationId,
        userId: event.userId,
        lastReadMessageId: event.lastReadMessageId,
      });

      for (const participantId of event.participantIds) {
        this.server.to(this.userRoom(participantId)).emit('conversation.read', {
          conversationId: event.conversationId,
          userId: event.userId,
          lastReadMessageId: event.lastReadMessageId,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to parse read event: ${(error as Error).message}`);
    }
  }

  private broadcastMessageEditedEvent(payload: string): void {
    try {
      const event = JSON.parse(payload) as MessageEditedEvent;
      const roomName = this.conversationRoom(event.conversationId);

      this.server.to(roomName).emit('message.edited', event.message);
      for (const participantId of event.participantIds) {
        this.server
          .to(this.userRoom(participantId))
          .emit('conversation.message_edited', {
            conversationId: event.conversationId,
            message: event.message,
          });
      }
    } catch (error) {
      this.logger.error(`Failed to parse message edited event: ${(error as Error).message}`);
    }
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private broadcastNotificationEvent(payload: string): void {
    try {
      const event = JSON.parse(payload) as NotificationCreatedEvent;
      this.server.to(this.userRoom(event.userId)).emit('notification.new', event.notification);
    } catch (error) {
      this.logger.error(`Failed to parse notification event: ${(error as Error).message}`);
    }
  }

  private broadcastNotificationReadEvent(payload: string): void {
    try {
      const event = JSON.parse(payload) as NotificationReadEvent;
      this.server.to(this.userRoom(event.userId)).emit('notification.read', {
        notificationId: event.notificationId,
        readAll: event.readAll ?? false,
      });
    } catch (error) {
      this.logger.error(`Failed to parse notification read event: ${(error as Error).message}`);
    }
  }

  private broadcastAttachmentLifecycleEvent(
    eventName: 'message.attachment.uploaded' | 'message.attachment.failed',
    payload: string,
  ): void {
    try {
      const event = JSON.parse(payload) as MessageAttachmentLifecycleEvent;
      const roomName = this.conversationRoom(event.conversationId);

      this.server.to(roomName).emit(eventName, event);
      for (const participantId of event.participantIds) {
        this.server.to(this.userRoom(participantId)).emit(eventName, event);
      }
    } catch (error) {
      this.logger.error(`Failed to parse ${eventName} event: ${(error as Error).message}`);
    }
  }

  private broadcastMessageReactionUpdatedEvent(payload: string): void {
    try {
      const event = JSON.parse(payload) as MessageReactionUpdatedEvent;
      const roomName = this.conversationRoom(event.conversationId);

      this.server.to(roomName).emit('message.reaction.updated', event);
      for (const participantId of event.participantIds) {
        this.server.to(this.userRoom(participantId)).emit('message.reaction.updated', event);
      }
    } catch (error) {
      this.logger.error(`Failed to parse message reaction updated event: ${(error as Error).message}`);
    }
  }
}
