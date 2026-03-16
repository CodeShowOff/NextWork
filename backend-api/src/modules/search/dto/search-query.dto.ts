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
}
