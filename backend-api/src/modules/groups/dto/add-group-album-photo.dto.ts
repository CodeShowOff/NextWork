import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddGroupAlbumPhotoDto {
  @ApiProperty({ format: 'uuid', description: 'A scanned image MediaObject scoped to this group.' })
  @IsUUID('all')
  mediaId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
