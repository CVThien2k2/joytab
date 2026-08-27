import { Transform } from 'class-transformer';
import { IsBoolean, IsString, IsUUID, Length, Matches } from 'class-validator';
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

/**
 * Param của GET /organizations/by-code/:code — mã lấy từ URL nên chuẩn hoá y hệt lúc gõ tay:
 * link chia sẻ qua chat hay bị đổi hoa/thường hoặc dính dấu gạch.
 */
export class JoinCodeParamDto {
  @Transform(({ value }): unknown => normalizeJoinCode(value))
  @IsString({ message: 'Mã tham gia không hợp lệ' })
  @Matches(JOIN_CODE_REGEX, { message: 'Mã tham gia gồm 8 ký tự chữ và số' })
  code: string;
}

/**
 * Body của PATCH /organizations/:id. Hiện chỉ có đúng một công tắc: mở/đóng cửa vào bằng mã.
 * Không gộp đổi tên vào đây — đổi tên là hành vi khác, khi nào cần thì thêm trường riêng.
 */
export class UpdateOrganizationDto {
  @IsBoolean({ message: 'Giá trị bật/tắt không hợp lệ' })
  joinByCodeEnabled: boolean;
}

/**
 * Param id của PATCH /organizations/:id. Bắt buộc validate: id không phải UUID mà đưa thẳng
 * xuống Prisma thì cột kiểu uuid ném lỗi driver → 500, trong khi đây là lỗi của client.
 */
export class OrganizationIdParamDto {
  // Không khoá phiên bản: cột id là `uuid()` của Prisma (hiện là v4), khoá cứng '4' ở đây
  // là để một lần đổi default sang v7 làm hỏng mọi request mà không ai ngờ tới.
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  id: string;
}
