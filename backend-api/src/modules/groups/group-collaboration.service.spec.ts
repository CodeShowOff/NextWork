import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiver } from 'livekit-server-sdk';

import { PrismaService } from '../../common/database/prisma.service';
import { MediaService } from '../media/media.service';
import { GroupsService } from './groups.service';
import { GroupCollaborationService } from './group-collaboration.service';

describe('GroupCollaborationService', () => {
  const prismaMock = {
    groupEvent: { findFirst: jest.fn(), findUnique: jest.fn() },
    groupEventRsvp: { upsert: jest.fn() },
    liveSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
  const groupsServiceMock = { getGroupAccess: jest.fn() };
  const mediaServiceMock = {};
  const configServiceMock = {
    get: jest.fn((key: string) => ({
      LIVEKIT_URL: 'wss://nextwork.livekit.cloud',
      LIVEKIT_API_KEY: 'api-key',
      LIVEKIT_API_SECRET: 'api-secret',
    })[key]),
  };
  const service = new GroupCollaborationService(
    prismaMock as unknown as PrismaService,
    groupsServiceMock as unknown as GroupsService,
    mediaServiceMock as MediaService,
    configServiceMock as unknown as ConfigService,
  );
  const roomServiceMock = { createRoom: jest.fn(), deleteRoom: jest.fn() };
  const serviceWithPrivateRoomClient = service as unknown as {
    createRoomServiceClient: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    serviceWithPrivateRoomClient.createRoomServiceClient = jest.fn(() => roomServiceMock);
    groupsServiceMock.getGroupAccess.mockResolvedValue({ canManage: true });
    roomServiceMock.createRoom.mockResolvedValue({});
    roomServiceMock.deleteRoom.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('upserts an RSVP and returns all attendee counts for the viewer', async () => {
    prismaMock.groupEvent.findFirst.mockResolvedValue({ id: 'event-1' });
    prismaMock.groupEventRsvp.upsert.mockResolvedValue({});
    prismaMock.groupEvent.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
      createdById: 'host-1',
      title: 'Planning',
      description: null,
      location: null,
      startsAt: new Date('2026-07-20T09:00:00.000Z'),
      endsAt: null,
      timezone: 'Asia/Kolkata',
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt: new Date('2026-07-01T09:00:00.000Z'),
      createdBy: { profile: { displayName: 'Host', avatarUrl: null } },
      rsvps: [
        { userId: 'viewer-1', status: 'going' },
        { userId: 'member-2', status: 'maybe' },
        { userId: 'member-3', status: 'declined' },
      ],
    });

    const result = await service.setEventRsvp('viewer-1', 'group-1', 'event-1', { status: 'going' });

    expect(prismaMock.groupEventRsvp.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: 'event-1', userId: 'viewer-1' } },
        create: { eventId: 'event-1', userId: 'viewer-1', status: 'going' },
      }),
    );
    expect(result).toMatchObject({
      rsvp: 'going',
      attendeeCounts: { going: 1, maybe: 1, declined: 1 },
    });
  });

  it('creates the LiveKit room before issuing a short-lived join token', async () => {
    prismaMock.liveSession.findFirst.mockResolvedValue(null);
    prismaMock.liveSession.create.mockImplementation(async ({ data }: { data: { groupId: string; startedById: string; roomName: string } }) => ({
      id: 'session-1',
      groupId: data.groupId,
      roomName: data.roomName,
      startedById: data.startedById,
      status: 'active',
      startedAt: new Date('2026-07-20T09:00:00.000Z'),
      endedAt: null,
    }));

    const result = await service.startLiveSession('host-1', 'group-1');

    expect(roomServiceMock.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining('group-group-1-') }),
    );
    expect(result).toMatchObject({ id: 'session-1', started: true, serverUrl: 'wss://nextwork.livekit.cloud', expiresInSeconds: 600 });
    expect(result.token.split('.')).toHaveLength(3);
  });

  it('closes the actual LiveKit room before marking the session ended', async () => {
    prismaMock.liveSession.findFirst.mockResolvedValue({
      id: 'session-1',
      groupId: 'group-1',
      roomName: 'group-group-1-room',
      startedById: 'host-1',
      status: 'active',
      startedAt: new Date(),
      endedAt: null,
    });
    prismaMock.liveSession.update.mockResolvedValue({});

    await expect(service.endLiveSession('host-1', 'group-1')).resolves.toEqual({ status: 'ok' });

    expect(roomServiceMock.deleteRoom).toHaveBeenCalledWith('group-group-1-room');
    expect(prismaMock.liveSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ended', endedById: 'host-1' }) }),
    );
  });

  it('reconciles a signed LiveKit room_finished webhook', async () => {
    jest.spyOn(WebhookReceiver.prototype, 'receive').mockResolvedValue({
      event: 'room_finished',
      room: { name: 'group-group-1-room' },
    } as never);
    prismaMock.liveSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.reconcileLiveKitWebhook('Bearer signed-webhook', '{"event":"room_finished"}')).resolves.toEqual({ status: 'ok' });

    expect(prismaMock.liveSession.updateMany).toHaveBeenCalledWith({
      where: { roomName: 'group-group-1-room', status: 'active' },
      data: { status: 'ended', endedAt: expect.any(Date) },
    });
  });

  it('rejects an invalid LiveKit webhook signature', async () => {
    jest.spyOn(WebhookReceiver.prototype, 'receive').mockRejectedValue(new Error('invalid signature'));

    await expect(service.reconcileLiveKitWebhook('Bearer invalid', '{}')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
