import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import {
  NotificationPreferencesView,
  NotificationsService,
  PaginatedNotificationsResponse,
} from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationsService.listForUser(user.sub, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Post(':notificationId/read')
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('notificationId') notificationId: string,
  ): Promise<{ status: 'ok' }> {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload): Promise<{ status: 'ok'; updated: number }> {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: JwtPayload): Promise<NotificationPreferencesView> {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesView> {
    return this.notificationsService.updatePreferences(user.sub, payload);
  }

  @Get('muted-users')
  listMutedUsers(@CurrentUser() user: JwtPayload): Promise<{ items: Array<{ userId: string; displayName: string; avatarUrl: string | null }> }> {
    return this.notificationsService.listMutedActors(user.sub);
  }

  @Post('muted-users/:mutedUserId')
  muteUser(
    @CurrentUser() user: JwtPayload,
    @Param('mutedUserId', new ParseUUIDPipe({ version: '4' })) mutedUserId: string,
  ): Promise<{ status: 'ok' }> {
    return this.notificationsService.muteActor(user.sub, mutedUserId);
  }

  @Delete('muted-users/:mutedUserId')
  unmuteUser(
    @CurrentUser() user: JwtPayload,
    @Param('mutedUserId', new ParseUUIDPipe({ version: '4' })) mutedUserId: string,
  ): Promise<{ status: 'ok' }> {
    return this.notificationsService.unmuteActor(user.sub, mutedUserId);
  }
}
