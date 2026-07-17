import { ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { MediaScanQueueService } from './media-scan-queue.service';
import { MediaService } from './media.service';
import { ObjectStorageService } from './object-storage.service';

describe('MediaService private object access', () => {
  const prismaMock = {
    mediaObject: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    messageAttachment: { findFirst: jest.fn() },
    postMedia: { findFirst: jest.fn() },
    follow: { findUnique: jest.fn() },
    group: { findUnique: jest.fn() },
    groupMember: { findUnique: jest.fn() },
    organizationMember: { findUnique: jest.fn() },
  };
  const storageMock = {
    createUploadUrl: jest.fn(),
    createDownloadUrl: jest.fn(),
    deleteObjects: jest.fn(),
    headObject: jest.fn(),
  };
  const scanQueueMock = { enqueue: jest.fn() };
  const service = new MediaService(
    prismaMock as unknown as PrismaService,
    storageMock as unknown as ObjectStorageService,
    scanQueueMock as unknown as MediaScanQueueService,
  );

  const availableMedia = {
    id: 'm1',
    ownerId: 'sender',
    groupId: null,
    storageKey: 'private/sender/m1.jpg',
    originalFileName: 'm1.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    status: 'available',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.mediaObject.findUnique.mockResolvedValue(availableMedia);
    storageMock.createDownloadUrl.mockResolvedValue('https://signed.example/m1.jpg');
  });

  it('returns an upload-only contract and never exposes a download URL before scanning', async () => {
    prismaMock.mediaObject.create.mockResolvedValue({ ...availableMedia, status: 'pending_upload' });
    storageMock.createUploadUrl.mockResolvedValue('https://signed.example/upload');

    const contract = await service.createUploadContract('sender', {
      fileName: 'm1.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    });

    expect(contract).toEqual(expect.objectContaining({ mediaId: 'm1', uploadUrl: 'https://signed.example/upload' }));
    expect(contract).not.toHaveProperty('publicUrl');
    expect(storageMock.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('allows a direct-message participant to obtain a scoped download URL', async () => {
    prismaMock.messageAttachment.findFirst.mockResolvedValue({ id: 'attachment-1' });

    const result = await service.createDownloadUrl('recipient', 'm1');

    expect(result.downloadUrl).toBe('https://signed.example/m1.jpg');
    expect(prismaMock.messageAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mediaObjectId: 'm1' }),
      }),
    );
  });

  it('denies an unrelated person access to a private object', async () => {
    prismaMock.messageAttachment.findFirst.mockResolvedValue(null);
    prismaMock.postMedia.findFirst.mockResolvedValue(null);

    await expect(service.createDownloadUrl('outsider', 'm1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows followers to download media on follower-visible posts', async () => {
    prismaMock.messageAttachment.findFirst.mockResolvedValue(null);
    prismaMock.postMedia.findFirst.mockResolvedValue({
      post: { authorId: 'sender', visibility: 'followers', groupId: null },
    });
    prismaMock.follow.findUnique.mockResolvedValue({ followerId: 'follower' });

    await expect(service.createDownloadUrl('follower', 'm1')).resolves.toEqual(
      expect.objectContaining({ mediaId: 'm1' }),
    );
  });
});
