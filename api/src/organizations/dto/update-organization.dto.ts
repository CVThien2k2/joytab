import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ORGANIZATION_NAME_MAX_LENGTH } from '../organizations.constants';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(ORGANIZATION_NAME_MAX_LENGTH)
  name?: string;

  /** Cho phép null tường minh để gỡ avatar; bỏ trắng field thì giữ nguyên giá trị cũ. */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl({ require_tld: false })
  avatarUrl?: string | null;
}
