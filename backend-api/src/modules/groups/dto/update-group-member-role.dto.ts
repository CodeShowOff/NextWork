import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGroupMemberRoleDto {
  @ApiProperty({ enum: ['owner', 'admin', 'member'] })
  @IsIn(['owner', 'admin', 'member'])
  role!: 'owner' | 'admin' | 'member';
}
