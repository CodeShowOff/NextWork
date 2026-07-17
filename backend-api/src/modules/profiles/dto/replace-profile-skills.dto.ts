import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class ReplaceProfileSkillsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  skills!: string[];
}
