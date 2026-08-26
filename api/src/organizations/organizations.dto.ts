import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import {
  JOIN_CODE_REGEX,
  MAX_ORGANIZATION_NAME_LENGTH,
  MIN_ORGANIZATION_NAME_LENGTH,
} from './organizations.constants';
import { normalizeJoinCode, normalizeOrganizationName } from './organizations.utils';

/**
 * Body của POST /organizations. Chỉ cần tên — mã tham gia do BE sinh, công tắc mở cửa mặc
 * định TẮT nên tổ chức mới tạo là kín cho tới khi owner tự bật.
 */
export class CreateOrganizationDto {
  @Transform(({ value }): unknown => normalizeOrganizationName(value))
  @IsString({ message: 'Tên tổ chức không hợp lệ' })
  @Length(MIN_ORGANIZATION_NAME_LENGTH, MAX_ORGANIZATION_NAME_LENGTH, {
    message: `Tên tổ chức phải từ ${MIN_ORGANIZATION_NAME_LENGTH} đến ${MAX_ORGANIZATION_NAME_LENGTH} ký tự`,
  })
  name: string;
}

/** Body của POST /organizations/join. */
export class JoinOrganizationDto {
  @Transform(({ value }): unknown => normalizeJoinCode(value))
  @IsString({ message: 'Mã tham gia không hợp lệ' })
  @Matches(JOIN_CODE_REGEX, { message: 'Mã tham gia gồm 8 ký tự chữ và số' })
  joinCode: string;
}
