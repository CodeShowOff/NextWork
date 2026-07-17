import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';

import { PrismaService } from '../../common/database/prisma.service';
import { ClamavScannerService } from './clamav-scanner.service';
import { ObjectStorageService } from './object-storage.service';

@Injectable()
export class MediaScanQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaScanQueueService.name);
  private readonly queueName = 'media-scan';
  private readonly exportOnlyMode = process.env.OPENAPI_EXPORT_ONLY === 'true';
  private queue?: Queue<{ mediaId: string }>;
  private worker?: Worker<{ mediaId: string }>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly scanner: ClamavScannerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.exportOnlyMode) {
      return;
    }
    const connection = {
      url: this.configService.getOrThrow<string>('REDIS_URL'),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };
    this.queue = new Queue(this.queueName, { connection });
    this.worker = new Worker(this.queueName, async (job) => this.scan(job.data.mediaId), { connection, concurrency: 2 });
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Media scan ${job?.id ?? 'unknown'} failed: ${error.message}`);
    });
    await Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.worker?.close(), this.queue?.close()]);
  }

  async enqueue(mediaId: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Media scan queue is not initialized.');
    }
    await this.queue.add('scan-media', { mediaId }, {
      jobId: `scan:${mediaId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 24 * 3600, count: 10000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 10000 },
    });
  }

  private async scan(mediaId: string): Promise<void> {
    const media = await this.prisma.mediaObject.findUnique({ where: { id: mediaId } });
    if (!media || media.status !== 'scanning') {
      return;
    }
    try {
      const content = await this.storage.readObject(media.storageKey);
      const result = await this.scanner.scan({
        content,
        contentType: media.contentType,
        fileName: media.originalFileName,
      });
      await this.prisma.mediaObject.update({
        where: { id: mediaId },
        data: result.clean
          ? { status: 'available', scanDetail: result.detail, availableAt: new Date() }
          : { status: 'quarantined', scanDetail: result.detail },
      });
    } catch (error) {
      await this.prisma.mediaObject.update({
        where: { id: mediaId },
        data: { status: 'quarantined', scanDetail: `Scan failed: ${(error as Error).message}` },
      });
      throw error;
    }
  }
}
