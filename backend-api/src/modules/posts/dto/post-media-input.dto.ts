import { IsIn, IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';

const MEDIA_TYPES = ['image', 'video'] as const;

export class PostMediaInputDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsIn(MEDIA_TYPES)
  type!: (typeof MEDIA_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12000)
  height?: number;
}
