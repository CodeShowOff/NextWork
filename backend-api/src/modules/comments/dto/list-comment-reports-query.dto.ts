import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const allowedStatuses = ['open', 'resolved', 'all'] as const;

export class ListCommentReportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(allowedStatuses)
  status?: (typeof allowedStatuses)[number];
}
