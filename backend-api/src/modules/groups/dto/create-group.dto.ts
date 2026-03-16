import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
}
