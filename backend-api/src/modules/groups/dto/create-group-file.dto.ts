import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupFileDto {
  @ApiProperty({ format: 'uuid', description: 'A scanned MediaObject scoped to this group.' })
  @IsUUID('all')
  mediaId!: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}
