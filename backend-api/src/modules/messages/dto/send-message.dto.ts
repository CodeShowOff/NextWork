import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const ALLOWED_ATTACHMENT_MEDIA_TYPES = ['image', 'video', 'document'] as const;
const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
] as const;

export class MessageAttachmentDto {
  @IsOptional()
  @IsUUID()
  attachmentId?: string;

  @IsIn(ALLOWED_ATTACHMENT_MEDIA_TYPES)
  mediaType!: (typeof ALLOWED_ATTACHMENT_MEDIA_TYPES)[number];

  @IsIn(ALLOWED_ATTACHMENT_MIME_TYPES)
  mimeType!: (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fileName!: string;

  @IsInt()
  @Max(50 * 1024 * 1024)
  fileSizeBytes!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  storageKey!: string;

  @IsUrl({ require_tld: false }, { message: 'publicUrl must be a valid URL.' })
  @MaxLength(500)
  publicUrl!: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsOptional()
  @IsInt()
  durationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  thumbnailKey?: string;
}

export class SendMessageDto {
  @ValidateIf((value: SendMessageDto) => !value.attachments?.length)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  messageType?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
