import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  likeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  commentEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  followEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  messageEnabled?: boolean;
}
