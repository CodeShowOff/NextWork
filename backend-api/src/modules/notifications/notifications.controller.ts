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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { DeviceTokenHeartbeatDto } from './dto/device-token-heartbeat.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { SendThanksDto } from './dto/send-thanks.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import {
  DeviceTokenRegistrationView,
  NotificationPreferencesView,
  NotificationsService,
  PaginatedNotificationsResponse,
} from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiTags('notifications')
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiOkResponse({ description: 'Paginated notifications result' })
  listNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationsService.listForUser(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ description: 'Unread notifications count' })
  getUnreadCount(@CurrentUser() user: JwtPayload): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Post(':notificationId/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'notificationId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Mark-read status' })
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('notificationId') notificationId: string,
  ): Promise<{ status: 'ok' }> {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @Post(':notificationId/open')
  @ApiOperation({ summary: 'Open notification and resolve target action' })
  @ApiParam({ name: 'notificationId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Open action payload with read flag' })
  openNotification(
    @CurrentUser() user: JwtPayload,
    @Param('notificationId') notificationId: string,
  ): Promise<{
    status: 'ok';
    readApplied: boolean;
    action: {
      target: 'messages' | 'profile' | 'feed';
      entityType: string;
      entityId: string;
    };
  }> {
    return this.notificationsService.openNotification(user.sub, notificationId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'Bulk mark-read status and count' })
  markAllRead(@CurrentUser() user: JwtPayload): Promise<{ status: 'ok'; updated: number }> {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiOkResponse({ description: 'Current notification preference flags' })
  getPreferences(@CurrentUser() user: JwtPayload): Promise<NotificationPreferencesView> {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiOkResponse({ description: 'Updated notification preference flags' })
  updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() payload: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesView> {
    return this.notificationsService.updatePreferences(user.sub, payload);
  }

  @Get('muted-users')
  @ApiOperation({ summary: 'List muted notification actors' })
  @ApiOkResponse({ description: 'Muted users list' })
  listMutedUsers(@CurrentUser() user: JwtPayload): Promise<{ items: Array<{ userId: string; displayName: string; avatarUrl: string | null }> }> {
    return this.notificationsService.listMutedActors(user.sub);
  }

  @Post('muted-users/:mutedUserId')
  @ApiOperation({ summary: 'Mute notifications from one user' })
  @ApiParam({ name: 'mutedUserId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Mute status' })
  muteUser(
    @CurrentUser() user: JwtPayload,
    @Param('mutedUserId', new ParseUUIDPipe()) mutedUserId: string,
  ): Promise<{ status: 'ok' }> {
    return this.notificationsService.muteActor(user.sub, mutedUserId);
  }

  @Delete('muted-users/:mutedUserId')
  @ApiOperation({ summary: 'Unmute notifications from one user' })
  @ApiParam({ name: 'mutedUserId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Unmute status' })
  unmuteUser(
    @CurrentUser() user: JwtPayload,
    @Param('mutedUserId', new ParseUUIDPipe()) mutedUserId: string,
  ): Promise<{ status: 'ok' }> {
    return this.notificationsService.unmuteActor(user.sub, mutedUserId);
  }

  @Post('device-tokens/register')
  @ApiOperation({ summary: 'Register or rebind a push device token for current user' })
  @ApiBody({ type: RegisterDeviceTokenDto })
  @ApiOkResponse({ description: 'Device token registration result' })
  registerDeviceToken(
    @CurrentUser() user: JwtPayload,
    @Body() payload: RegisterDeviceTokenDto,
  ): Promise<{ status: 'ok'; deviceToken: DeviceTokenRegistrationView }> {
    return this.notificationsService.registerDeviceToken(user.sub, payload);
  }

  @Post('device-tokens/heartbeat')
  @ApiOperation({ summary: 'Update last-seen timestamp for an existing device token' })
  @ApiBody({ type: DeviceTokenHeartbeatDto })
  @ApiOkResponse({ description: 'Heartbeat update status' })
  heartbeatDeviceToken(
    @CurrentUser() user: JwtPayload,
    @Body() payload: DeviceTokenHeartbeatDto,
  ): Promise<{ status: 'ok'; found: boolean }> {
    return this.notificationsService.heartbeatDeviceToken(user.sub, payload);
  }

  @Post('device-tokens/unregister')
  @ApiOperation({ summary: 'Unregister one device token for current user' })
  @ApiBody({ type: UnregisterDeviceTokenDto })
  @ApiOkResponse({ description: 'Device token removal status' })
  unregisterDeviceToken(
    @CurrentUser() user: JwtPayload,
    @Body() payload: UnregisterDeviceTokenDto,
  ): Promise<{ status: 'ok'; removed: boolean }> {
    return this.notificationsService.unregisterDeviceToken(user.sub, payload);
  }

  @Post('profile-actions/thanks')
  @ApiOperation({ summary: 'Send thanks profile action notification' })
  @ApiBody({ type: SendThanksDto })
  @ApiOkResponse({ description: 'Thanks action delivery result' })
  sendThanks(
    @CurrentUser() user: JwtPayload,
    @Body() payload: SendThanksDto,
  ): Promise<{
    status: 'ok';
    delivered: boolean;
    muted: boolean;
    notificationId: string | null;
    conversationId: string | null;
    messageId: string | null;
  }> {
    return this.notificationsService.sendThanks(user.sub, payload);
  }
}
