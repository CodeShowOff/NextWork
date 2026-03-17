import { IsIn, IsString, MaxLength } from 'class-validator';

export const ALLOWED_REACTION_TYPES = [
  'thumbsup',
  'heart',
  'laughing',
  'astonished',
  'cry',
  'angry',
] as const;

export type AllowedReactionType = (typeof ALLOWED_REACTION_TYPES)[number];

export class UpsertMessageReactionDto {
  @IsString()
  @MaxLength(32)
  @IsIn(ALLOWED_REACTION_TYPES)
  reactionType!: AllowedReactionType;
}
