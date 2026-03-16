import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const allowedReasons = ['abuse', 'harassment', 'spam', 'hate', 'other'] as const;

export class CreateCommentReportDto {
  @IsString()
  @IsIn(allowedReasons)
  reason!: (typeof allowedReasons)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
