import { IsIn } from 'class-validator';

export class ResolveGroupMembershipRequestDto {
  @IsIn(['approve', 'decline'])
  action!: 'approve' | 'decline';
}
