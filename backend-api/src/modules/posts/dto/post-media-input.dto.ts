import { IsIn, IsInt, IsNotEmpty, IsOptional, IsUUID, IsUrl, Max, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MEDIA_TYPES = ['image', 'video'] as const;

export class PostMediaInputDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'A scanned private MediaObject uploaded by the post author.' })
  @IsOptional()
  @IsUUID()
  mediaId?: string;

  @ApiPropertyOptional({ format: 'uri', description: 'Legacy media URL. New clients must send mediaId.' })
  @ValidateIf((value: PostMediaInputDto) => !value.mediaId)
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url?: string;

  @ApiProperty({ enum: MEDIA_TYPES })
  @IsIn(MEDIA_TYPES)
  type!: (typeof MEDIA_TYPES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 12000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12000)
  width?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12000)
  height?: number;
}
