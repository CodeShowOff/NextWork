import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VotePollDto {
  @ApiProperty({ maxLength: 64 })
  @IsString()
  @MaxLength(64)
  optionId!: string;
}
