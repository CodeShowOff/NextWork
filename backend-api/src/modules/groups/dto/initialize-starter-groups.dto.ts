import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class InitializeStarterGroupsDto {
  @IsUUID('all')
  organizationId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  selectedKeys?: string[];

  @IsOptional()
  @IsBoolean()
  skipped?: boolean;
}

