import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MALE_RATIO_DECIMALS, MAX_MALE_RATIO, MIN_MALE_RATIO } from '../matches/matches.constants';
import {
  JOIN_CODE_REGEX,
  MAX_ORGANIZATION_NAME_LENGTH,
  MEMBER_SEARCH_MAX_LENGTH,
  MEMBERS_DEFAULT_PAGE_SIZE,
  MEMBERS_MAX_PAGE_SIZE,
  MAX_PAYMENT_QR_URL_LENGTH,
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
 * Body của PATCH /organizations/:id. Mọi field đều TUỲ CHỌN và độc lập: gửi field nào thì đổi
 * field đó, không gửi thì giữ nguyên. Nhờ vậy popup đổi tên không phải gửi kèm trạng thái công
 * tắc (và vô tình xoay mã tham gia), cũng không phải gửi lại ảnh QR.
 *
 * `whitelist: true` của ValidationPipe loại field lạ, nhưng body RỖNG vẫn hợp lệ — service coi
 * đó là không có gì để đổi.
 */
export class UpdateOrganizationDto {
  @IsOptional()
  @Transform(({ value }): unknown => normalizeOrganizationName(value))
  @IsString({ message: 'Tên tổ chức không hợp lệ' })
  @Length(MIN_ORGANIZATION_NAME_LENGTH, MAX_ORGANIZATION_NAME_LENGTH, {
    message: `Tên tổ chức phải từ ${MIN_ORGANIZATION_NAME_LENGTH} đến ${MAX_ORGANIZATION_NAME_LENGTH} ký tự`,
  })
  name?: string;

  @IsOptional()
  @IsBoolean({ message: 'Giá trị bật/tắt không hợp lệ' })
  joinByCodeEnabled?: boolean;

  /**
   * Ảnh QR chuyển khoản của tổ chức. Chuỗi RỖNG là hợp lệ và có nghĩa là gỡ QR — khác với
   * không gửi field (giữ nguyên), nên không dùng @IsUrl trần được.
   */
  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ảnh QR không hợp lệ' })
  @MaxLength(MAX_PAYMENT_QR_URL_LENGTH, { message: 'Đường dẫn ảnh QR quá dài' })
  paymentQrUrl?: string;

  /** Hệ số nam mặc định cho trận mới. Nữ luôn là mốc 1. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: MALE_RATIO_DECIMALS },
    { message: `Hệ số nam tối đa ${MALE_RATIO_DECIMALS} chữ số thập phân` },
  )
  @Min(MIN_MALE_RATIO, { message: `Hệ số nam phải từ ${MIN_MALE_RATIO}` })
  @Max(MAX_MALE_RATIO, { message: `Hệ số nam không quá ${MAX_MALE_RATIO}` })
  maleRatio?: number;
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

/**
 * Query của GET /organizations/:id/members.
 *
 * `@Type(() => Number)` là bắt buộc: query string luôn là chuỗi, không convert thì @IsInt
 * trượt với mọi giá trị. ValidationPipe đã bật `transform: true` nên decorator này ăn.
 *
 * `page` đếm từ 1 (không phải 0): hợp đồng này đọc bằng mắt trên URL nhiều hơn là đưa vào
 * thư viện bảng, nên 1-based khớp với con số người dùng thấy trên nút phân trang.
 */
export class ListMembersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang không hợp lệ' })
  @Min(1, { message: 'Số trang phải từ 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi trang không hợp lệ' })
  @Min(1, { message: 'Số dòng mỗi trang phải từ 1' })
  @Max(MEMBERS_MAX_PAGE_SIZE, {
    message: `Số dòng mỗi trang tối đa ${MEMBERS_MAX_PAGE_SIZE}`,
  })
  pageSize: number = MEMBERS_DEFAULT_PAGE_SIZE;

  /** Tìm theo tên hoặc email. Chuỗi rỗng sau khi trim = không tìm gì. */
  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Từ khoá tìm kiếm không hợp lệ' })
  @MaxLength(MEMBER_SEARCH_MAX_LENGTH, {
    message: `Từ khoá tìm kiếm tối đa ${MEMBER_SEARCH_MAX_LENGTH} ký tự`,
  })
  q?: string;
}

/**
 * Param của DELETE /organizations/:id/members/:userId. Cả hai đều phải validate: id không
 * phải UUID mà đưa thẳng xuống Prisma thì driver ném lỗi → 500, trong khi đây là lỗi client.
 */
export class OrganizationMemberParamDto {
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  id: string;

  @IsUUID(undefined, { message: 'Id thành viên không hợp lệ' })
  userId: string;
}
