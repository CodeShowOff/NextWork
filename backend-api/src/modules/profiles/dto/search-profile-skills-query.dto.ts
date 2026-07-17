import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchProfileSkillsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q?: string;
}
