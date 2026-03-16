import { IsUUID } from 'class-validator';

export class MarkReadDto {
  @IsUUID('4')
  lastReadMessageId!: string;
}
