import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { Gender, GENDERS } from '../common/utils/types';
import {
  MAX_FULL_NAME_LENGTH,
  MAX_USER_AGE,
  MIN_FULL_NAME_LENGTH,
  MIN_USER_AGE,
  VN_MOBILE_PHONE_REGEX,
} from './auth.constants';

/**
 * Input: Giá trị thô của field `fullName` trong body.
 * Output: Chuỗi đã trim và gộp khoảng trắng liên tiếp; giá trị không phải string đi qua
 *         nguyên vẹn để @IsString báo lỗi.
 */
export function normalizeFullName(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Input: Giá trị thô của field `age` (FE gửi number, nhưng form/curl có thể gửi chuỗi số).
 * Output: number nếu là chuỗi toàn chữ số, ngược lại giữ nguyên.
 *
 * Cố tình KHÔNG dùng @Type(() => Number): Number("abc") ra NaN, và NaN là một `number` nên
 * có nguy cơ lọt qua kiểm tra kiểu; ở đây "abc" vẫn là string nên @IsInt chắc chắn từ chối.
 */
export function normalizeAge(value: unknown): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return value;
}

/**
 * Input: Chuỗi SĐT người dùng gõ vào — cho phép khoảng trắng, dấu chấm/gạch, tiền tố +84/84.
 * Output: Dạng chuẩn 10 số bắt đầu bằng 0 để lưu DB và so khớp regex; giữ nguyên input nếu
 *         không nhận ra được dạng nào (để @Matches báo lỗi thay vì âm thầm bóp méo).
 *
 * Chuẩn hoá TRƯỚC khi validate là có chủ ý: "+84 912 345 678" và "0912345678" là cùng một số,
 * người dùng không nên bị từ chối chỉ vì cách gõ.
 */
export function normalizeVietnamPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const compact = value.replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
  if (compact.startsWith('84') && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
}

/**
 * Body của POST /auth/onboarding. Cả 4 field đều BẮT BUỘC — onboarding là bước xác nhận
 * thông tin, không phải form tuỳ chọn.
 *
 * ValidationPipe toàn cục (main.ts) đã bật `transform` + `whitelist` nên @Transform chạy
 * trước các validator và field lạ bị loại bỏ, không cần cấu hình gì thêm ở controller.
 */
export class CompleteOnboardingDto {
  @Transform(({ value }): unknown => normalizeFullName(value))
  @IsString({ message: 'Họ tên không hợp lệ' })
  @Length(MIN_FULL_NAME_LENGTH, MAX_FULL_NAME_LENGTH, {
    message: `Họ tên phải từ ${MIN_FULL_NAME_LENGTH} đến ${MAX_FULL_NAME_LENGTH} ký tự`,
  })
  fullName: string;

  @Transform(({ value }): unknown => normalizeAge(value))
  @IsInt({ message: 'Tuổi phải là số nguyên' })
  @Min(MIN_USER_AGE, { message: `Tuổi phải từ ${MIN_USER_AGE} đến ${MAX_USER_AGE}` })
  @Max(MAX_USER_AGE, { message: `Tuổi phải từ ${MIN_USER_AGE} đến ${MAX_USER_AGE}` })
  age: number;

  @IsIn(GENDERS, { message: 'Giới tính không hợp lệ' })
  gender: Gender;

  @Transform(({ value }): unknown => normalizeVietnamPhone(value))
  @IsString({ message: 'Số điện thoại không hợp lệ' })
  @Matches(VN_MOBILE_PHONE_REGEX, {
    message: 'Số điện thoại phải là số di động Việt Nam (vd 0912345678)',
  })
  phone: string;
}
