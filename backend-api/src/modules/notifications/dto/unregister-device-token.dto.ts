import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { DEVICE_TOKEN_PLATFORMS } from './register-device-token.dto';

export class UnregisterDeviceTokenDto {
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  token!: string;

  @IsOptional()
  @IsString()
  @IsIn(DEVICE_TOKEN_PLATFORMS)
  platform?: (typeof DEVICE_TOKEN_PLATFORMS)[number];
}
