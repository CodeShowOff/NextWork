import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertGroupEventRsvpDto {
  @ApiProperty({ enum: ['going', 'maybe', 'declined'] })
  @IsIn(['going', 'maybe', 'declined'])
  status!: 'going' | 'maybe' | 'declined';
}
