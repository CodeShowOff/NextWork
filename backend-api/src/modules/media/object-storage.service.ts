import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredObjectMetadata {
  contentType: string | undefined;
  sizeBytes: number | undefined;
}

@Injectable()
export class ObjectStorageService {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT') ?? 'http://127.0.0.1:9000';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID') ?? 'minioadmin';
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY') ?? 'minioadmin';
    this.bucket = this.configService.get<string>('S3_BUCKET') ?? 'workplace';
    this.client = new S3Client({
      region: this.configService.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint,
      forcePathStyle: this.configService.get<string>('S3_FORCE_PATH_STYLE') !== 'false',
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  createUploadUrl(objectKey: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  createDownloadUrl(objectKey: string, fileName: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/[\r\n"]/g, '_')}"`,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async headObject(objectKey: string): Promise<StoredObjectMetadata | null> {
    try {
      const object = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return {
        contentType: object.ContentType,
        sizeBytes: object.ContentLength,
      };
    } catch (error) {
      const code = (error as { name?: string; $metadata?: { httpStatusCode?: number } }).name;
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (code === 'NotFound' || code === 'NoSuchKey' || status === 404) {
        return null;
      }
      throw error;
    }
  }

  async readObject(objectKey: string): Promise<Uint8Array> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!object.Body) {
      throw new Error('Object storage returned an empty body');
    }

    const stream = object.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> };
    if (stream.transformToByteArray) {
      return stream.transformToByteArray();
    }

    throw new Error('Object storage response cannot be scanned in this runtime');
  }

  async deleteObjects(objectKeys: string[]): Promise<void> {
    for (let index = 0; index < objectKeys.length; index += 1000) {
      const batch = objectKeys.slice(index, index + 1000);
      if (!batch.length) {
        continue;
      }
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }
}
