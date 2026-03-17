import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search phrase', minLength: 1, maxLength: 100 })
  @IsString()
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 25, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for users section pagination' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  usersCursor?: string;

  @ApiPropertyOptional({ description: 'Cursor for groups section pagination' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  groupsCursor?: string;

  @ApiPropertyOptional({ description: 'Cursor for posts section pagination' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  postsCursor?: string;

  @ApiPropertyOptional({
    description: 'Section scope to query. all returns every section.',
    enum: ['all', 'users', 'groups', 'posts'],
    default: 'all',
  })
  @IsOptional()
  @IsString()
  scope?: 'all' | 'users' | 'groups' | 'posts';
}
