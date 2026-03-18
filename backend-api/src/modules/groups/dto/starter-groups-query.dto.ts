import { IsUUID } from 'class-validator';

export class StarterGroupsQueryDto {
  @IsUUID('all')
  organizationId!: string;
}

