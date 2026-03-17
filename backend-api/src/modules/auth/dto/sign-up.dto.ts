import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  organizationSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;
}
