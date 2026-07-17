import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/database/prisma.service';
import { ClamavScannerService } from './clamav-scanner.service';
import { MediaScanQueueService } from './media-scan-queue.service';
import { ObjectStorageService } from './object-storage.service';

describe('MediaScanQueueService', () => {
  const prismaMock = {
    mediaObject: { findUnique: jest.fn(), update: jest.fn() },
  };
  const storageMock = { readObject: jest.fn() };
  const scannerMock = { scan: jest.fn() };
  const service = new MediaScanQueueService(
    { getOrThrow: jest.fn() } as unknown as ConfigService,
    prismaMock as unknown as PrismaService,
    storageMock as unknown as ObjectStorageService,
    scannerMock as unknown as ClamavScannerService,
  );
  const serviceWithScan = service as unknown as { scan: (mediaId: string) => Promise<void> };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.mediaObject.findUnique.mockResolvedValue({
      id: 'media-1',
      status: 'scanning',
      storageKey: 'private/owner/media-1.pdf',
      contentType: 'application/pdf',
      originalFileName: 'media-1.pdf',
    });
    storageMock.readObject.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it('publishes a file only after the scanner confirms it is clean', async () => {
    scannerMock.scan.mockResolvedValue({ clean: true, detail: 'clean' });

    await serviceWithScan.scan('media-1');

    expect(prismaMock.mediaObject.update).toHaveBeenCalledWith({
      where: { id: 'media-1' },
      data: { status: 'available', scanDetail: 'clean', availableAt: expect.any(Date) },
    });
  });

  it('quarantines the file when scanning fails', async () => {
    scannerMock.scan.mockRejectedValue(new Error('scanner unavailable'));

    await expect(serviceWithScan.scan('media-1')).rejects.toThrow('scanner unavailable');

    expect(prismaMock.mediaObject.update).toHaveBeenCalledWith({
      where: { id: 'media-1' },
      data: { status: 'quarantined', scanDetail: 'Scan failed: scanner unavailable' },
    });
  });
});
