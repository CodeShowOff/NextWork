import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const allowedActions = ['dismiss', 'remove_comment'] as const;

export class ResolveCommentReportDto {
  @IsString()
  @IsIn(allowedActions)
  action!: (typeof allowedActions)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
