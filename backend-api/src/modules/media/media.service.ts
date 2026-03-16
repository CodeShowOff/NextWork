import { Injectable } from '@nestjs/common';
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
};

@Injectable()
export class MediaService {
  createUploadContract(userId: string, payload: CreateUploadUrlDto): UploadContractResponse {
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
