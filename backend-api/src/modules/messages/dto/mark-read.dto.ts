import { IsUUID } from 'class-validator';

export class MarkReadDto {
  @IsUUID('all')
  lastReadMessageId!: string;
}

