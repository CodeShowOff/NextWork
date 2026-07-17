import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { AddGroupAlbumPhotoDto } from './dto/add-group-album-photo.dto';
import { CreateGroupAlbumDto } from './dto/create-group-album.dto';
import { CreateGroupEventDto } from './dto/create-group-event.dto';
import { CreateGroupFileDto } from './dto/create-group-file.dto';
import { UpdateGroupEventDto } from './dto/update-group-event.dto';
import { UpsertGroupEventRsvpDto } from './dto/upsert-group-event-rsvp.dto';
import { GroupCollaborationService } from './group-collaboration.service';

@Controller('groups')
export class GroupCollaborationController {
  constructor(private readonly collaborationService: GroupCollaborationService) {}

  @Post('live/webhook')
  reconcileLiveKitWebhook(@Headers('authorization') authorization: string | undefined, @Req() request: Request & { rawBody?: Buffer }) {
    const rawBody = request.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('LiveKit webhook body is missing');
    }
    return this.collaborationService.reconcileLiveKitWebhook(authorization, rawBody);
  }

  @Get(':groupId/files')
  @UseGuards(JwtAuthGuard)
  listFiles(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.listFiles(user.sub, groupId);
  }

  @Post(':groupId/files')
  @UseGuards(JwtAuthGuard)
  createFile(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload: CreateGroupFileDto,
  ) {
    return this.collaborationService.createFile(user.sub, groupId, payload);
  }

  @Get(':groupId/files/:fileId/download')
  @UseGuards(JwtAuthGuard)
  getFileDownload(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.collaborationService.getFileDownload(user.sub, groupId, fileId);
  }

  @Delete(':groupId/files/:fileId')
  @UseGuards(JwtAuthGuard)
  deleteFile(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.collaborationService.deleteFile(user.sub, groupId, fileId);
  }

  @Get(':groupId/albums')
  @UseGuards(JwtAuthGuard)
  listAlbums(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.listAlbums(user.sub, groupId);
  }

  @Post(':groupId/albums')
  @UseGuards(JwtAuthGuard)
  createAlbum(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload: CreateGroupAlbumDto,
  ) {
    return this.collaborationService.createAlbum(user.sub, groupId, payload);
  }

  @Get(':groupId/albums/:albumId')
  @UseGuards(JwtAuthGuard)
  getAlbum(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('albumId') albumId: string,
  ) {
    return this.collaborationService.getAlbum(user.sub, groupId, albumId);
  }

  @Post(':groupId/albums/:albumId/photos')
  @UseGuards(JwtAuthGuard)
  addAlbumPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('albumId') albumId: string,
    @Body() payload: AddGroupAlbumPhotoDto,
  ) {
    return this.collaborationService.addAlbumPhoto(user.sub, groupId, albumId, payload);
  }

  @Get(':groupId/albums/:albumId/photos/:photoId/download')
  @UseGuards(JwtAuthGuard)
  getAlbumPhotoDownload(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('albumId') albumId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.collaborationService.getAlbumPhotoDownload(user.sub, groupId, albumId, photoId);
  }

  @Delete(':groupId/albums/:albumId/photos/:photoId')
  @UseGuards(JwtAuthGuard)
  deleteAlbumPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('albumId') albumId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.collaborationService.deleteAlbumPhoto(user.sub, groupId, albumId, photoId);
  }

  @Get(':groupId/events')
  @UseGuards(JwtAuthGuard)
  listEvents(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.listEvents(user.sub, groupId);
  }

  @Post(':groupId/events')
  @UseGuards(JwtAuthGuard)
  createEvent(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() payload: CreateGroupEventDto,
  ) {
    return this.collaborationService.createEvent(user.sub, groupId, payload);
  }

  @Patch(':groupId/events/:eventId')
  @UseGuards(JwtAuthGuard)
  updateEvent(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('eventId') eventId: string,
    @Body() payload: UpdateGroupEventDto,
  ) {
    return this.collaborationService.updateEvent(user.sub, groupId, eventId, payload);
  }

  @Delete(':groupId/events/:eventId')
  @UseGuards(JwtAuthGuard)
  deleteEvent(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.collaborationService.deleteEvent(user.sub, groupId, eventId);
  }

  @Put(':groupId/events/:eventId/rsvp')
  @UseGuards(JwtAuthGuard)
  setEventRsvp(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('eventId') eventId: string,
    @Body() payload: UpsertGroupEventRsvpDto,
  ) {
    return this.collaborationService.setEventRsvp(user.sub, groupId, eventId, payload);
  }

  @Get(':groupId/events/:eventId/calendar')
  @UseGuards(JwtAuthGuard)
  exportEventCalendar(
    @CurrentUser() user: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.collaborationService.exportEventCalendar(user.sub, groupId, eventId);
  }

  @Get(':groupId/live')
  @UseGuards(JwtAuthGuard)
  getLiveSession(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.getLiveSession(user.sub, groupId);
  }

  @Post(':groupId/live/start')
  @UseGuards(JwtAuthGuard)
  startLiveSession(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.startLiveSession(user.sub, groupId);
  }

  @Post(':groupId/live/join')
  @UseGuards(JwtAuthGuard)
  joinLiveSession(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.joinLiveSession(user.sub, groupId);
  }

  @Post(':groupId/live/end')
  @UseGuards(JwtAuthGuard)
  endLiveSession(@CurrentUser() user: JwtPayload, @Param('groupId') groupId: string) {
    return this.collaborationService.endLiveSession(user.sub, groupId);
  }
}
