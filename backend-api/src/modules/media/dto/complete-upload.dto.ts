import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  mediaId!: string;
}
