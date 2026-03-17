import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { GROUP_PRIVACY_OPTIONS, GROUP_TYPE_OPTIONS } from '../groups.constants';

export class CreateGroupDto {
  @IsUUID('4')
  organizationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn([...GROUP_TYPE_OPTIONS])
  groupType?: string;

  @IsOptional()
  @IsString()
  @IsIn([...GROUP_PRIVACY_OPTIONS])
  groupPrivacy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}
