import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupInvitationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  invitedUserId!: string;
}
