import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const SEND_THANKS_NOTIFICATION_TYPES = ['thanks', 'thanks-note'] as const;

export class SendThanksDto {
  @IsUUID('all')
  targetUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageTemplate?: string;

  @IsOptional()
  @IsString()
  @IsIn(SEND_THANKS_NOTIFICATION_TYPES)
  notificationType?: (typeof SEND_THANKS_NOTIFICATION_TYPES)[number];
}
