import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

export interface UploadContractResponse {
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
  method: 'PUT';
  headers: {
    'Content-Type': string;
  };
  expiresInSeconds: number;
}

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'application/pdf': ['pdf'],
};

const MAX_BYTES_BY_CONTENT_TYPE: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'video/mp4': 25 * 1024 * 1024,
  'application/pdf': 15 * 1024 * 1024,
};

function extractFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDot + 1).toLowerCase();
}

@Injectable()
export class MediaService {
  createUploadContract(userId: string, payload: CreateUploadUrlDto): UploadContractResponse {
    const normalizedFileName = payload.fileName.trim();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(normalizedFileName) || normalizedFileName.includes('..')) {
      throw new BadRequestException('Invalid filename. Use 1-120 chars: letters, numbers, dot, underscore, dash.');
    }

    const extensionFromName = extractFileExtension(normalizedFileName);
    const allowedExtensions = EXTENSIONS_BY_CONTENT_TYPE[payload.contentType] ?? [];
    if (extensionFromName && !allowedExtensions.includes(extensionFromName)) {
      throw new BadRequestException('File extension does not match declared content type.');
    }

    if (payload.sizeBytes) {
      const maxBytes = MAX_BYTES_BY_CONTENT_TYPE[payload.contentType];
      if (!maxBytes || payload.sizeBytes > maxBytes) {
        throw new BadRequestException(`File size exceeds limit for ${payload.contentType}.`);
      }
    }

    const extension = CONTENT_TYPE_TO_EXTENSION[payload.contentType] ?? 'bin';
    const objectKey = `uploads/${userId}/${randomUUID()}.${extension}`;

    const uploadBase = process.env.MEDIA_UPLOAD_BASE_URL ?? 'https://uploads.workplace.local';
    const publicBase = process.env.MEDIA_PUBLIC_BASE_URL ?? 'https://cdn.workplace.local';

    return {
      objectKey,
      uploadUrl: `${uploadBase}/${objectKey}`,
      publicUrl: `${publicBase}/${objectKey}`,
      method: 'PUT',
      headers: {
        'Content-Type': payload.contentType,
      },
      expiresInSeconds: 900,
    };
  }

  isPublicMediaUrlAllowed(userId: string, mediaUrl: string): boolean {
    try {
      const publicBase = process.env.MEDIA_PUBLIC_BASE_URL ?? 'https://cdn.workplace.local';
      const base = new URL(publicBase);
      const candidate = new URL(mediaUrl);

      if (candidate.origin !== base.origin) {
        return false;
      }

      const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
      if (!candidate.pathname.startsWith(basePath)) {
        return false;
      }

      const relativePath = candidate.pathname.slice(basePath.length);
      const expectedPrefix = `uploads/${userId}/`;
      return relativePath.startsWith(expectedPrefix);
    } catch {
      return false;
    }
  }
}
