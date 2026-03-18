import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const DEVICE_TOKEN_PLATFORMS = ['ios', 'android', 'web'] as const;

export class RegisterDeviceTokenDto {
  @IsString()
  @IsIn(DEVICE_TOKEN_PLATFORMS)
  platform!: (typeof DEVICE_TOKEN_PLATFORMS)[number];

  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  token!: string;
}
