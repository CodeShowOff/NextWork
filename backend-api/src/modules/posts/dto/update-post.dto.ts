import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VISIBILITY_TYPES = ['public', 'followers', 'private'] as const;

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ enum: VISIBILITY_TYPES })
  @IsOptional()
  @IsIn(VISIBILITY_TYPES)
  visibility?: (typeof VISIBILITY_TYPES)[number];
}
