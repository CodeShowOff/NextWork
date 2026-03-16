import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { IdempotencyService } from '../../common/reliability/idempotency.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ConversationView,
  MessageView,
  MessagesService,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
} from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('conversations')
  createConversation(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateConversationDto,
  ): Promise<ConversationView> {
    return this.messagesService.createConversation(user.sub, payload);
  }

  @Get('conversations')
  listConversations(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedConversationsResponse> {
    return this.messagesService.listConversations(user.sub, query);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponse> {
    return this.messagesService.listMessages(user.sub, conversationId, query);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() payload: SendMessageDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<MessageView> {
    if (idempotencyKey?.trim()) {
      return this.idempotencyService.execute({
        scope: `send-message:${conversationId}`,
        userId: user.sub,
        idempotencyKey: idempotencyKey.trim(),
        ttlSeconds: 3600,
        run: () => this.messagesService.sendMessage(user.sub, conversationId, payload),
      });
    }

    return this.messagesService.sendMessage(user.sub, conversationId, payload);
  }

  @Post('conversations/:conversationId/read')
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId') conversationId: string,
    @Body() payload: MarkReadDto,
  ): Promise<{ status: 'ok' }> {
    await this.messagesService.markConversationRead(user.sub, conversationId, payload.lastReadMessageId);
    return { status: 'ok' };
  }
}
