import { IsBoolean } from 'class-validator';

export class UpdateGroupFavoriteDto {
  @IsBoolean()
  isFavorite!: boolean;
}
