import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/database/prisma.service';
import { MediaService } from '../media/media.service';
import { AddGroupAlbumPhotoDto } from './dto/add-group-album-photo.dto';
import { CreateGroupAlbumDto } from './dto/create-group-album.dto';
import { CreateGroupEventDto } from './dto/create-group-event.dto';
import { CreateGroupFileDto } from './dto/create-group-file.dto';
import { UpdateGroupEventDto } from './dto/update-group-event.dto';
import { UpsertGroupEventRsvpDto } from './dto/upsert-group-event-rsvp.dto';
import { GroupsService } from './groups.service';

type CollaborationAccess = Awaited<ReturnType<GroupsService['getGroupAccess']>>;

@Injectable()
export class GroupCollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
  ) {}

  async listFiles(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    const files = await this.prisma.groupFile.findMany({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { mediaObject: true, uploadedBy: { include: { profile: true } } },
    });
    return { groupId, items: files.map((file) => this.toFileView(file)) };
  }

  async createFile(userId: string, groupId: string, payload: CreateGroupFileDto) {
    await this.requireMember(userId, groupId);
    await this.mediaService.assertMediaObjectAvailableForGroup(userId, groupId, payload.mediaId);
    const file = await this.prisma.groupFile.create({
      data: {
        groupId,
        mediaObjectId: payload.mediaId,
        uploadedById: userId,
        title: payload.title?.trim() || null,
      },
      include: { mediaObject: true, uploadedBy: { include: { profile: true } } },
    });
    return this.toFileView(file);
  }

  async getFileDownload(userId: string, groupId: string, fileId: string) {
    await this.requireMember(userId, groupId);
    const file = await this.prisma.groupFile.findFirst({
      where: { id: fileId, groupId },
      select: { mediaObjectId: true },
    });
    if (!file) {
      throw new NotFoundException('Group file not found');
    }
    return this.mediaService.createDownloadUrl(userId, file.mediaObjectId);
  }

  async deleteFile(userId: string, groupId: string, fileId: string): Promise<{ status: 'ok' }> {
    const access = await this.requireMember(userId, groupId);
    const file = await this.prisma.groupFile.findFirst({
      where: { id: fileId, groupId },
      include: { mediaObject: true },
    });
    if (!file) {
      throw new NotFoundException('Group file not found');
    }
    if (!access.canManage && file.uploadedById !== userId) {
      throw new ForbiddenException('Only the uploader or a group administrator can remove this file');
    }
    await this.mediaService.deleteStoredObjects([file.mediaObject.storageKey]);
    await this.prisma.mediaObject.delete({ where: { id: file.mediaObjectId } });
    return { status: 'ok' };
  }

  async listAlbums(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    const albums = await this.prisma.groupAlbum.findMany({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { _count: { select: { photos: true } }, createdBy: { include: { profile: true } } },
    });
    return {
      groupId,
      items: albums.map((album) => ({
        id: album.id,
        title: album.title,
        description: album.description,
        createdAt: album.createdAt.toISOString(),
        photoCount: album._count.photos,
        createdBy: {
          id: album.createdById,
          displayName: album.createdBy.profile?.displayName ?? 'Unknown',
          avatarUrl: album.createdBy.profile?.avatarUrl ?? null,
        },
      })),
    };
  }

  async getAlbum(userId: string, groupId: string, albumId: string) {
    await this.requireMember(userId, groupId);
    const album = await this.prisma.groupAlbum.findFirst({
      where: { id: albumId, groupId },
      include: {
        createdBy: { include: { profile: true } },
        photos: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { mediaObject: true, uploadedBy: { include: { profile: true } } },
        },
      },
    });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return {
      id: album.id,
      groupId: album.groupId,
      title: album.title,
      description: album.description,
      createdAt: album.createdAt.toISOString(),
      createdBy: {
        id: album.createdById,
        displayName: album.createdBy.profile?.displayName ?? 'Unknown',
        avatarUrl: album.createdBy.profile?.avatarUrl ?? null,
      },
      photos: album.photos.map((photo) => this.toPhotoView(photo)),
    };
  }

  async createAlbum(userId: string, groupId: string, payload: CreateGroupAlbumDto) {
    await this.requireMember(userId, groupId);
    const title = payload.title.trim();
    if (!title) {
      throw new BadRequestException('Album title cannot be empty');
    }
    const album = await this.prisma.groupAlbum.create({
      data: {
        groupId,
        createdById: userId,
        title,
        description: payload.description?.trim() || null,
      },
      include: { createdBy: { include: { profile: true } } },
    });
    return {
      id: album.id,
      groupId: album.groupId,
      title: album.title,
      description: album.description,
      createdAt: album.createdAt.toISOString(),
      photoCount: 0,
      createdBy: {
        id: album.createdById,
        displayName: album.createdBy.profile?.displayName ?? 'Unknown',
        avatarUrl: album.createdBy.profile?.avatarUrl ?? null,
      },
    };
  }

  async addAlbumPhoto(userId: string, groupId: string, albumId: string, payload: AddGroupAlbumPhotoDto) {
    await this.requireMember(userId, groupId);
    const album = await this.prisma.groupAlbum.findFirst({ where: { id: albumId, groupId }, select: { id: true } });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    const media = await this.mediaService.assertMediaObjectAvailableForGroup(userId, groupId, payload.mediaId);
    if (!media.contentType.startsWith('image/')) {
      throw new BadRequestException('Only scanned image uploads can be added to a group album');
    }
    const photo = await this.prisma.groupAlbumPhoto.create({
      data: {
        albumId,
        mediaObjectId: payload.mediaId,
        uploadedById: userId,
        caption: payload.caption?.trim() || null,
      },
      include: { mediaObject: true, uploadedBy: { include: { profile: true } } },
    });
    return this.toPhotoView(photo);
  }

  async getAlbumPhotoDownload(userId: string, groupId: string, albumId: string, photoId: string) {
    await this.requireMember(userId, groupId);
    const photo = await this.prisma.groupAlbumPhoto.findFirst({
      where: { id: photoId, albumId, album: { groupId } },
      select: { mediaObjectId: true },
    });
    if (!photo) {
      throw new NotFoundException('Album photo not found');
    }
    return this.mediaService.createDownloadUrl(userId, photo.mediaObjectId);
  }

  async deleteAlbumPhoto(userId: string, groupId: string, albumId: string, photoId: string): Promise<{ status: 'ok' }> {
    const access = await this.requireMember(userId, groupId);
    const photo = await this.prisma.groupAlbumPhoto.findFirst({
      where: { id: photoId, albumId, album: { groupId } },
      include: { mediaObject: true },
    });
    if (!photo) {
      throw new NotFoundException('Album photo not found');
    }
    if (!access.canManage && photo.uploadedById !== userId) {
      throw new ForbiddenException('Only the uploader or a group administrator can remove this photo');
    }
    await this.mediaService.deleteStoredObjects([photo.mediaObject.storageKey]);
    await this.prisma.mediaObject.delete({ where: { id: photo.mediaObjectId } });
    return { status: 'ok' };
  }

  async listEvents(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    const events = await this.prisma.groupEvent.findMany({
      where: { groupId },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      include: { createdBy: { include: { profile: true } }, rsvps: true },
    });
    return { groupId, items: events.map((event) => this.toEventView(event, userId)) };
  }

  async createEvent(userId: string, groupId: string, payload: CreateGroupEventDto) {
    await this.requireMember(userId, groupId);
    const data = this.normalizeEventPayload(payload);
    const event = await this.prisma.groupEvent.create({
      data: { groupId, createdById: userId, ...data },
      include: { createdBy: { include: { profile: true } }, rsvps: true },
    });
    return this.toEventView(event, userId);
  }

  async updateEvent(userId: string, groupId: string, eventId: string, payload: UpdateGroupEventDto) {
    const access = await this.requireMember(userId, groupId);
    const existing = await this.prisma.groupEvent.findFirst({ where: { id: eventId, groupId } });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    if (!access.canManage && existing.createdById !== userId) {
      throw new ForbiddenException('Only the event creator or a group administrator can edit this event');
    }
    const data = this.normalizeEventPayload({
      title: payload.title ?? existing.title,
      description: payload.description ?? existing.description ?? undefined,
      location: payload.location ?? existing.location ?? undefined,
      startsAt: payload.startsAt ?? existing.startsAt.toISOString(),
      endsAt: payload.endsAt ?? existing.endsAt?.toISOString(),
      timezone: payload.timezone ?? existing.timezone,
    });
    const event = await this.prisma.groupEvent.update({
      where: { id: eventId },
      data,
      include: { createdBy: { include: { profile: true } }, rsvps: true },
    });
    return this.toEventView(event, userId);
  }

  async deleteEvent(userId: string, groupId: string, eventId: string): Promise<{ status: 'ok' }> {
    const access = await this.requireMember(userId, groupId);
    const event = await this.prisma.groupEvent.findFirst({ where: { id: eventId, groupId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (!access.canManage && event.createdById !== userId) {
      throw new ForbiddenException('Only the event creator or a group administrator can delete this event');
    }
    await this.prisma.groupEvent.delete({ where: { id: eventId } });
    return { status: 'ok' };
  }

  async setEventRsvp(userId: string, groupId: string, eventId: string, payload: UpsertGroupEventRsvpDto) {
    await this.requireMember(userId, groupId);
    const event = await this.prisma.groupEvent.findFirst({ where: { id: eventId, groupId }, select: { id: true } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    await this.prisma.groupEventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: payload.status },
      update: { status: payload.status },
    });
    const refreshed = await this.prisma.groupEvent.findUnique({
      where: { id: eventId },
      include: { createdBy: { include: { profile: true } }, rsvps: true },
    });
    if (!refreshed) {
      throw new NotFoundException('Event not found');
    }
    return this.toEventView(refreshed, userId);
  }

  async exportEventCalendar(userId: string, groupId: string, eventId: string) {
    await this.requireMember(userId, groupId);
    const event = await this.prisma.groupEvent.findFirst({ where: { id: eventId, groupId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Workplace//Group Event//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@workplace`,
      `DTSTAMP:${this.toIcsDate(new Date())}`,
      `DTSTART:${this.toIcsDate(event.startsAt)}`,
      ...(event.endsAt ? [`DTEND:${this.toIcsDate(event.endsAt)}`] : []),
      `SUMMARY:${this.escapeIcs(event.title)}`,
      ...(event.description ? [`DESCRIPTION:${this.escapeIcs(event.description)}`] : []),
      ...(event.location ? [`LOCATION:${this.escapeIcs(event.location)}`] : []),
      `X-WR-TIMEZONE:${this.escapeIcs(event.timezone)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return {
      fileName: `${event.title.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 60) || 'group-event'}.ics`,
      contentType: 'text/calendar; charset=utf-8',
      content: `${lines.join('\r\n')}\r\n`,
    };
  }

  async getLiveSession(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    const session = await this.prisma.liveSession.findFirst({
      where: { groupId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    return { session: session ? this.toLiveSessionView(session) : null };
  }

  async startLiveSession(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    let session = await this.prisma.liveSession.findFirst({
      where: { groupId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    let started = false;
    if (!session) {
      const roomName = `group-${groupId}-${randomUUID()}`;
      const roomService = this.createRoomServiceClient();
      try {
        await roomService.createRoom({ name: roomName, emptyTimeout: 300, departureTimeout: 60 });
        session = await this.prisma.liveSession.create({
          data: { groupId, startedById: userId, roomName },
        });
        started = true;
      } catch (error) {
        await roomService.deleteRoom(roomName).catch(() => undefined);
        // The partial unique index prevents two concurrent starts. Return the winning room instead.
        const raced = await this.prisma.liveSession.findFirst({
          where: { groupId, status: 'active' },
          orderBy: { startedAt: 'desc' },
        });
        if (!raced) {
          throw error;
        }
        session = raced;
      }
    }
    return { ...this.toLiveSessionView(session), started, ...await this.createLiveToken(session.roomName, userId) };
  }

  async joinLiveSession(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    const session = await this.prisma.liveSession.findFirst({
      where: { groupId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      throw new NotFoundException('No active live room for this group');
    }
    return { ...this.toLiveSessionView(session), ...await this.createLiveToken(session.roomName, userId) };
  }

  async endLiveSession(userId: string, groupId: string): Promise<{ status: 'ok' }> {
    const access = await this.requireMember(userId, groupId);
    const session = await this.prisma.liveSession.findFirst({
      where: { groupId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) {
      return { status: 'ok' };
    }
    if (!access.canManage && session.startedById !== userId) {
      throw new ForbiddenException('Only the host or a group administrator can end this live room');
    }
    try {
      await this.createRoomServiceClient().deleteRoom(session.roomName);
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      if (!message.includes('not found')) {
        throw new ServiceUnavailableException('Unable to end the LiveKit room. Please try again.');
      }
    }
    await this.prisma.liveSession.update({
      where: { id: session.id },
      data: { status: 'ended', endedById: userId, endedAt: new Date() },
    });
    return { status: 'ok' };
  }

  async reconcileLiveKitWebhook(authorization: string | undefined, rawBody: string): Promise<{ status: 'ok' }> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Live rooms are not configured for this environment');
    }

    let event: { event?: string; room?: { name?: string } };
    try {
      event = await new WebhookReceiver(apiKey, apiSecret).receive(rawBody, authorization);
    } catch {
      throw new ForbiddenException('Invalid LiveKit webhook signature');
    }

    const roomName = event.room?.name;
    if (!roomName || event.event !== 'room_finished') {
      return { status: 'ok' };
    }
    await this.prisma.liveSession.updateMany({
      where: { roomName, status: 'active' },
      data: { status: 'ended', endedAt: new Date() },
    });
    return { status: 'ok' };
  }

  private async requireMember(userId: string, groupId: string): Promise<CollaborationAccess> {
    return this.groupsService.getGroupAccess(userId, groupId, { requireMember: true });
  }

  private toFileView(file: {
    id: string;
    groupId: string;
    mediaObjectId: string;
    title: string | null;
    createdAt: Date;
    mediaObject: { originalFileName: string; contentType: string; sizeBytes: number; status: string };
    uploadedById: string;
    uploadedBy: { profile: { displayName: string; avatarUrl: string | null } | null };
  }) {
    return {
      id: file.id,
      groupId: file.groupId,
      mediaId: file.mediaObjectId,
      title: file.title,
      fileName: file.mediaObject.originalFileName,
      contentType: file.mediaObject.contentType,
      sizeBytes: file.mediaObject.sizeBytes,
      status: file.mediaObject.status,
      createdAt: file.createdAt.toISOString(),
      uploadedBy: {
        id: file.uploadedById,
        displayName: file.uploadedBy.profile?.displayName ?? 'Unknown',
        avatarUrl: file.uploadedBy.profile?.avatarUrl ?? null,
      },
    };
  }

  private toPhotoView(photo: {
    id: string;
    mediaObjectId: string;
    caption: string | null;
    createdAt: Date;
    uploadedById: string;
    mediaObject: { originalFileName: string; contentType: string; sizeBytes: number; status: string };
    uploadedBy: { profile: { displayName: string; avatarUrl: string | null } | null };
  }) {
    return {
      id: photo.id,
      mediaId: photo.mediaObjectId,
      caption: photo.caption,
      fileName: photo.mediaObject.originalFileName,
      contentType: photo.mediaObject.contentType,
      sizeBytes: photo.mediaObject.sizeBytes,
      status: photo.mediaObject.status,
      createdAt: photo.createdAt.toISOString(),
      uploadedBy: {
        id: photo.uploadedById,
        displayName: photo.uploadedBy.profile?.displayName ?? 'Unknown',
        avatarUrl: photo.uploadedBy.profile?.avatarUrl ?? null,
      },
    };
  }

  private normalizeEventPayload(payload: {
    title: string;
    description?: string;
    location?: string;
    startsAt: string;
    endsAt?: string;
    timezone: string;
  }) {
    const title = payload.title.trim();
    if (!title) {
      throw new BadRequestException('Event title cannot be empty');
    }
    const startsAt = new Date(payload.startsAt);
    const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime())) || (endsAt && endsAt <= startsAt)) {
      throw new BadRequestException('Event end time must be after its start time');
    }
    try {
      Intl.DateTimeFormat('en-US', { timeZone: payload.timezone }).format(startsAt);
    } catch {
      throw new BadRequestException('Use a valid IANA timezone, such as Asia/Kolkata or America/New_York');
    }
    return {
      title,
      description: payload.description?.trim() || null,
      location: payload.location?.trim() || null,
      startsAt,
      endsAt,
      timezone: payload.timezone,
    };
  }

  private toEventView(event: {
    id: string;
    groupId: string;
    createdById: string;
    title: string;
    description: string | null;
    location: string | null;
    startsAt: Date;
    endsAt: Date | null;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { profile: { displayName: string; avatarUrl: string | null } | null };
    rsvps: Array<{ userId: string; status: 'going' | 'maybe' | 'declined' }>;
  }, viewerId: string) {
    const counts = { going: 0, maybe: 0, declined: 0 };
    for (const rsvp of event.rsvps) {
      counts[rsvp.status] += 1;
    }
    return {
      id: event.id,
      groupId: event.groupId,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      timezone: event.timezone,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      createdBy: {
        id: event.createdById,
        displayName: event.createdBy.profile?.displayName ?? 'Unknown',
        avatarUrl: event.createdBy.profile?.avatarUrl ?? null,
      },
      rsvp: event.rsvps.find((rsvp) => rsvp.userId === viewerId)?.status ?? null,
      attendeeCounts: counts,
    };
  }

  private async createLiveToken(roomName: string, userId: string) {
    const { serverUrl, apiKey, apiSecret } = this.liveKitCredentials();
    const token = new AccessToken(apiKey, apiSecret, { identity: userId, ttl: '10m' });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
    return { serverUrl, token: await token.toJwt(), expiresInSeconds: 600 };
  }

  private createRoomServiceClient(): RoomServiceClient {
    const { serverUrl, apiKey, apiSecret } = this.liveKitCredentials();
    const apiUrl = serverUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    return new RoomServiceClient(apiUrl, apiKey, apiSecret);
  }

  private liveKitCredentials() {
    const serverUrl = this.configService.get<string>('LIVEKIT_URL');
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Live rooms are not configured for this environment');
    }
    return { serverUrl, apiKey, apiSecret };
  }

  private toLiveSessionView(session: {
    id: string;
    groupId: string;
    roomName: string;
    startedById: string;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
  }) {
    return {
      id: session.id,
      groupId: session.groupId,
      roomName: session.roomName,
      startedById: session.startedById,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    };
  }

  private toIcsDate(value: Date): string {
    return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private escapeIcs(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
}
