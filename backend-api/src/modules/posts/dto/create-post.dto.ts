import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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

class CreatePostPollOptionDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  text!: string;
}

class CreatePostPollDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  question!: string;

  @ApiProperty({ type: [CreatePostPollOptionDto], minItems: 2, maxItems: 6 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CreatePostPollOptionDto)
  options!: CreatePostPollOptionDto[];
}

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

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  taggedUserIds?: string[];

  @ApiPropertyOptional({ type: CreatePostPollDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePostPollDto)
  poll?: CreatePostPollDto;
}
