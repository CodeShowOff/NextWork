import { IsArray, IsIn, IsOptional, IsUUID, MaxLength, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsIn(['direct', 'group'])
  type?: 'direct' | 'group';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  participantIds!: string[];

  @IsOptional()
  @MaxLength(80)
  title?: string;
}
