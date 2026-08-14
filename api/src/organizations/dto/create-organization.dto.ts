import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ORGANIZATION_NAME_MAX_LENGTH } from '../organizations.constants';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(ORGANIZATION_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
