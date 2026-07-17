import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export class CreateUploadUrlDto {
  @ApiProperty({ description: 'Original client filename' })
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9._-]+$/)
  fileName!: string;

  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES })
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: (typeof ALLOWED_CONTENT_TYPES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_UPLOAD_SIZE_BYTES })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_SIZE_BYTES)
  sizeBytes?: number;

  @ApiPropertyOptional({ description: 'Optional group scope for a collaboration upload', format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  groupId?: string;
}
