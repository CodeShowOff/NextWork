import { IsIn, IsOptional } from 'class-validator';

export class DeleteGroupDto {
  @IsOptional()
  @IsIn(['detach', 'remove'])
  postPolicy?: 'detach' | 'remove';
}
