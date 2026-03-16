import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PostMediaInputDto } from './post-media-input.dto';

const VISIBILITY_TYPES = ['public', 'followers', 'private'] as const;

export class CreatePostDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ enum: VISIBILITY_TYPES })
  @IsOptional()
  @IsIn(VISIBILITY_TYPES)
  visibility?: (typeof VISIBILITY_TYPES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  groupId?: string;

  @ApiPropertyOptional({ type: [PostMediaInputDto], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PostMediaInputDto)
  media?: PostMediaInputDto[];
}
