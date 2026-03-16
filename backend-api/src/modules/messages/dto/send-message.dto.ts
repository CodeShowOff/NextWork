import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  messageType?: string;
}
