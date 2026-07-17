import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/database/prisma.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { MediaScanQueueService } from './media-scan-queue.service';
import { ObjectStorageService } from './object-storage.service';

export interface UploadContractResponse {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: { 'Content-Type': string };
  expiresInSeconds: number;
}

export interface CompletedUploadResponse {
  mediaId: string;
  status: 'scanning' | 'available' | 'quarantined' | 'rejected';
  downloadUrl: string | null;
}

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
};

const MAX_BYTES_BY_CONTENT_TYPE: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'video/mp4': 100 * 1024 * 1024,
  'application/pdf': 25 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 25 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 25 * 1024 * 1024,
};

function extractFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot <= 0 || lastDot === fileName.length - 1 ? null : fileName.slice(lastDot + 1).toLowerCase();
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly scanQueue: MediaScanQueueService,
  ) {}

  async createUploadContract(userId: string, payload: CreateUploadUrlDto): Promise<UploadContractResponse> {
    const fileName = this.validateUpload(payload);
    if (payload.groupId) {
      await this.assertCanContributeToGroup(userId, payload.groupId);
    }

    const extension = CONTENT_TYPE_TO_EXTENSION[payload.contentType] ?? 'bin';
    const objectKey = `private/${userId}/${randomUUID()}.${extension}`;
    const media = await this.prisma.mediaObject.create({
      data: {
        ownerId: userId,
        groupId: payload.groupId,
        storageKey: objectKey,
        originalFileName: fileName,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes ?? 0,
      },
    });

    try {
      const uploadUrl = await this.storage.createUploadUrl(objectKey, payload.contentType);
      return {
        mediaId: media.id,
        objectKey,
        uploadUrl,
        method: 'PUT',
        headers: { 'Content-Type': payload.contentType },
        expiresInSeconds: 900,
      };
    } catch (error) {
      await this.prisma.mediaObject.delete({ where: { id: media.id } }).catch(() => undefined);
      throw error;
    }
  }

  async completeUpload(userId: string, mediaId: string): Promise<CompletedUploadResponse> {
    const media = await this.getOwnedMediaObject(userId, mediaId);
    if (media.status === 'available') {
      return {
        mediaId,
        status: 'available',
        downloadUrl: await this.storage.createDownloadUrl(media.storageKey, media.originalFileName),
      };
    }
    if (media.status === 'quarantined' || media.status === 'rejected') {
      return { mediaId, status: media.status, downloadUrl: null };
    }

    const object = await this.storage.headObject(media.storageKey);
    if (!object) {
      throw new BadRequestException('Upload has not reached object storage yet. Please retry completion.');
    }
    if (object.contentType !== media.contentType) {
      await this.reject(media.id, 'Uploaded content type does not match the signed upload contract.');
      throw new BadRequestException('Uploaded content type does not match the upload contract.');
    }
    const sizeBytes = object.sizeBytes ?? 0;
    const maximum = MAX_BYTES_BY_CONTENT_TYPE[media.contentType];
    if (!sizeBytes || !maximum || sizeBytes > maximum || (media.sizeBytes > 0 && sizeBytes !== media.sizeBytes)) {
      await this.reject(media.id, 'Uploaded object size does not match the upload contract.');
      throw new BadRequestException('Uploaded object size does not match the upload contract.');
    }

    await this.prisma.mediaObject.update({
      where: { id: media.id },
      data: { sizeBytes, uploadedAt: new Date(), status: 'scanning', scanDetail: null },
    });
    try {
      await this.scanQueue.enqueue(media.id);
    } catch (error) {
      await this.prisma.mediaObject.update({
        where: { id: media.id },
        data: { status: 'quarantined', scanDetail: `Unable to queue security scan: ${(error as Error).message}` },
      });
      throw new BadRequestException('Upload is quarantined because its security scan could not be queued.');
    }
    return { mediaId: media.id, status: 'scanning', downloadUrl: null };
  }

  async createDownloadUrl(userId: string, mediaId: string): Promise<{ mediaId: string; downloadUrl: string; expiresInSeconds: number }> {
    const media = await this.prisma.mediaObject.findUnique({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException('Media object not found');
    }
    await this.assertCanAccessMedia(userId, media);
    if (media.status !== 'available') {
      throw new ForbiddenException('This file is quarantined until its security scan succeeds.');
    }
    return {
      mediaId,
      downloadUrl: await this.storage.createDownloadUrl(media.storageKey, media.originalFileName),
      expiresInSeconds: 300,
    };
  }

  async getMediaStatus(userId: string, mediaId: string) {
    const media = await this.prisma.mediaObject.findUnique({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException('Media object not found');
    }
    await this.assertCanAccessMedia(userId, media);
    return {
      mediaId: media.id,
      status: media.status,
      scanDetail: media.scanDetail,
      fileName: media.originalFileName,
      contentType: media.contentType,
      sizeBytes: media.sizeBytes,
    };
  }

  async assertMediaObjectAvailableForGroup(userId: string, groupId: string, mediaId: string): Promise<{
    id: string;
    storageKey: string;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
  }> {
    const media = await this.getOwnedMediaObject(userId, mediaId);
    if (media.groupId !== groupId) {
      throw new ForbiddenException('This upload is not scoped to the selected group.');
    }
    if (media.status !== 'available') {
      throw new ForbiddenException('This file cannot be published until its security scan succeeds.');
    }
    await this.assertMediaObjectUnattached(media.id);
    return media;
  }

  async assertMediaObjectAvailableForMessage(userId: string, mediaId: string): Promise<{
    id: string;
    storageKey: string;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
  }> {
    const media = await this.getOwnedMediaObject(userId, mediaId);
    if (media.groupId) {
      throw new ForbiddenException('Group-scoped uploads cannot be attached to a direct message.');
    }
    if (media.status !== 'available') {
      throw new ForbiddenException('This file cannot be sent until its security scan succeeds.');
    }
    await this.assertMediaObjectUnattached(media.id);
    return media;
  }

  async assertMediaObjectAvailableForPost(userId: string, groupId: string | undefined, mediaId: string): Promise<{
    id: string;
    storageKey: string;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
  }> {
    const media = await this.getOwnedMediaObject(userId, mediaId);
    if ((media.groupId ?? undefined) !== groupId) {
      throw new ForbiddenException('This upload is not scoped to the selected post destination.');
    }
    if (media.status !== 'available') {
      throw new ForbiddenException('This file cannot be published until its security scan succeeds.');
    }
    await this.assertMediaObjectUnattached(media.id);
    return media;
  }

  async deleteOwnedMediaObjects(userId: string, mediaIds: string[]): Promise<void> {
    if (!mediaIds.length) {
      return;
    }
    const media = await this.prisma.mediaObject.findMany({
      where: { id: { in: mediaIds }, ownerId: userId },
      select: { id: true, storageKey: true },
    });
    if (!media.length) {
      return;
    }
    await this.storage.deleteObjects(media.map((item) => item.storageKey));
    await this.prisma.mediaObject.deleteMany({ where: { id: { in: media.map((item) => item.id) }, ownerId: userId } });
  }

  async deleteStoredObjects(objectKeys: string[]): Promise<void> {
    await this.storage.deleteObjects(objectKeys);
  }

  /** Compatibility validation for clients still sending pre-migration signed media URLs. */
  isPublicMediaUrlAllowed(userId: string, mediaUrl: string): boolean {
    try {
      const candidate = new URL(mediaUrl);
      return candidate.pathname.includes(`/private/${userId}/`) || candidate.pathname.includes(`/uploads/${userId}/`);
    } catch {
      return false;
    }
  }

  private validateUpload(payload: CreateUploadUrlDto): string {
    const fileName = payload.fileName.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(fileName) || fileName.includes('..')) {
      throw new BadRequestException('Invalid filename. Use 1-120 chars: letters, numbers, dot, underscore, dash.');
    }
    const extension = extractFileExtension(fileName);
    const allowedExtensions = EXTENSIONS_BY_CONTENT_TYPE[payload.contentType] ?? [];
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new BadRequestException('File extension does not match declared content type.');
    }
    const maximum = MAX_BYTES_BY_CONTENT_TYPE[payload.contentType];
    if (!maximum || (payload.sizeBytes !== undefined && payload.sizeBytes > maximum)) {
      throw new BadRequestException(`File size exceeds limit for ${payload.contentType}.`);
    }
    return fileName;
  }

  private async getOwnedMediaObject(userId: string, mediaId: string) {
    const media = await this.prisma.mediaObject.findUnique({ where: { id: mediaId } });
    if (!media || media.ownerId !== userId) {
      throw new NotFoundException('Media object not found');
    }
    return media;
  }

  private async assertMediaObjectUnattached(mediaId: string): Promise<void> {
    const [groupFile, albumPhoto, messageAttachment, postMedia] = await Promise.all([
      this.prisma.groupFile.findUnique({ where: { mediaObjectId: mediaId }, select: { id: true } }),
      this.prisma.groupAlbumPhoto.findUnique({ where: { mediaObjectId: mediaId }, select: { id: true } }),
      this.prisma.messageAttachment.findUnique({ where: { mediaObjectId: mediaId }, select: { id: true } }),
      this.prisma.postMedia.findUnique({ where: { mediaObjectId: mediaId }, select: { id: true } }),
    ]);
    if (groupFile || albumPhoto || messageAttachment || postMedia) {
      throw new BadRequestException('This media object is already attached to another resource.');
    }
  }

  private async assertCanContributeToGroup(userId: string, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { organizationId: true } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    const [membership, organizationMembership] = await Promise.all([
      this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { userId: true } }),
      this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: group.organizationId, userId } },
        select: { role: true },
      }),
    ]);
    if (!organizationMembership || (!membership && organizationMembership.role !== 'owner' && organizationMembership.role !== 'admin')) {
      throw new ForbiddenException('Join this group before uploading collaboration resources.');
    }
  }

  private async assertCanAccessMedia(
    userId: string,
    media: { id: string; ownerId: string; groupId: string | null },
  ): Promise<void> {
    if (media.ownerId === userId) {
      return;
    }
    if (media.groupId) {
      await this.assertCanContributeToGroup(userId, media.groupId);
      return;
    }

    // Direct-message media remains private, but every participant in the
    // conversation needs a short-lived download URL after it is sent.
    const attachment = await this.prisma.messageAttachment.findFirst({
      where: {
        mediaObjectId: media.id,
        message: {
          conversation: {
            participants: { some: { userId } },
          },
        },
      },
      select: { id: true },
    });
    if (!attachment) {
      const postMedia = await this.prisma.postMedia.findFirst({
        where: { mediaObjectId: media.id },
        select: {
          post: {
            select: { authorId: true, visibility: true, groupId: true },
          },
        },
      });
      if (postMedia?.post) {
        if (postMedia.post.groupId) {
          await this.assertCanContributeToGroup(userId, postMedia.post.groupId);
          return;
        }
        if (postMedia.post.visibility === 'public') {
          return;
        }
        if (postMedia.post.visibility === 'followers') {
          const follows = await this.prisma.follow.findUnique({
            where: { followerId_followeeId: { followerId: userId, followeeId: postMedia.post.authorId } },
            select: { followerId: true },
          });
          if (follows) {
            return;
          }
        }
      }
      throw new ForbiddenException('Not allowed to access this private media object.');
    }
  }

  private reject(mediaId: string, scanDetail: string): Promise<void> {
    return this.prisma.mediaObject
      .update({ where: { id: mediaId }, data: { status: 'rejected', scanDetail } })
      .then(() => undefined);
  }
}
