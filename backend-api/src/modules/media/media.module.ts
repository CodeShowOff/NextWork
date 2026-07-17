import { Module } from '@nestjs/common';

import { MediaController } from './media.controller';
import { ClamavScannerService } from './clamav-scanner.service';
import { MediaScanQueueService } from './media-scan-queue.service';
import { MediaService } from './media.service';
import { ObjectStorageService } from './object-storage.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, ObjectStorageService, ClamavScannerService, MediaScanQueueService],
  exports: [MediaService],
})
export class MediaModule {}
