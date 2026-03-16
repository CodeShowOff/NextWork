import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class CreateUploadUrlDto {
  @ApiProperty({ description: 'Original client filename' })
  @IsString()
  fileName!: string;

  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES })
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: (typeof ALLOWED_CONTENT_TYPES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 10 * 1024 * 1024 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes?: number;
}
