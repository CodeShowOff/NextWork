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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ALLOWED_ATTACHMENT_MEDIA_TYPES = ['image', 'video', 'document'] as const;
const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export class MessageAttachmentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'A scanned MediaObject. Required for new attachments.' })
  @IsOptional()
  @IsUUID()
  mediaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  attachmentId?: string;

  @ApiProperty({ enum: ALLOWED_ATTACHMENT_MEDIA_TYPES })
  @IsIn(ALLOWED_ATTACHMENT_MEDIA_TYPES)
  mediaType!: (typeof ALLOWED_ATTACHMENT_MEDIA_TYPES)[number];

  @ApiProperty({ enum: ALLOWED_ATTACHMENT_MIME_TYPES })
  @IsIn(ALLOWED_ATTACHMENT_MIME_TYPES)
  mimeType!: (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fileName!: string;

  @ApiProperty({ maximum: 50 * 1024 * 1024 })
  @IsInt()
  @Max(50 * 1024 * 1024)
  fileSizeBytes!: number;

  @ApiProperty({ maxLength: 400 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  storageKey!: string;

  @ApiPropertyOptional({ format: 'uri', description: 'Legacy URL. New clients send mediaId instead.' })
  @ValidateIf((value: MessageAttachmentDto) => !value.mediaId)
  @IsUrl({ require_tld: false }, { message: 'publicUrl must be a valid URL.' })
  @IsNotEmpty()
  @MaxLength(500)
  publicUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  durationMs?: number;

  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  thumbnailKey?: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({ maxLength: 4000 })
  @ValidateIf((value: SendMessageDto) => !value.attachments?.length)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  messageType?: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
