import { IsUUID } from 'class-validator';

export class StarterGroupsQueryDto {
  @IsUUID('4')
  organizationId!: string;
}
