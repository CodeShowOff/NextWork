import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateInviteLinkDto {
  @IsUUID('4')
  organizationId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  expiresInHours?: number;
}
