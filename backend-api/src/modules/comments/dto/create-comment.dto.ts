import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsUUID('4')
  parentCommentId?: string;
}
