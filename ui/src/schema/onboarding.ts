import { z } from "zod"
import { genderSchema } from "@/schema/auth"

/**
 * Mirror của ràng buộc BE (api/src/auth/auth.constants.ts). BE vẫn là nguồn sự thật — validate
 * lại ở FE chỉ để user thấy lỗi ngay khi gõ chứ không phải để tin thay BE. Lệch nhau thì BE
 * thắng: form gửi lên vẫn bị 400 và message của BE được hiện ra.
 */
export const MIN_USER_AGE = 13
export const MAX_USER_AGE = 120
export const MIN_FULL_NAME_LENGTH = 2
export const MAX_FULL_NAME_LENGTH = 100

/** SĐT di động Việt Nam sau khi chuẩn hoá về 10 số bắt đầu bằng 0. Xem BE để biết đầu số. */
export const VN_MOBILE_PHONE_REGEX = /^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])\d{7}$/

/**
 * Input: Chuỗi SĐT user gõ (cho phép khoảng trắng, dấu, tiền tố +84/84).
 * Output: Dạng 10 số bắt đầu bằng 0. Giữ nguyên nếu không nhận ra dạng nào để regex báo lỗi.
 *         Cùng thuật toán với normalizeVietnamPhone ở BE.
 */
export function normalizeVietnamPhone(value: string): string {
  const compact = value.replace(/[\s.\-()]/g, "")
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`
  return compact
}

/**
 * Schema của form onboarding.
 *
 * `age` vào là string (input HTML luôn trả string) và ra là number — dùng `.transform` chứ
 * không `z.coerce.number()`: coerce biến "" thành 0 nên "bỏ trống" sẽ lọt qua thành 0 tuổi.
 * Vì vậy z.input (giá trị form) khác z.output (payload gửi BE), xem @/types/onboarding.
 *
 * `phone` cũng transform về dạng chuẩn ngay trong schema để BE nhận đúng thứ FE đã validate.
 */
export const onboardingFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập họ tên")
    .min(MIN_FULL_NAME_LENGTH, `Họ tên phải từ ${MIN_FULL_NAME_LENGTH} ký tự`)
    .max(MAX_FULL_NAME_LENGTH, `Họ tên tối đa ${MAX_FULL_NAME_LENGTH} ký tự`)
    .transform((value) => value.replace(/\s+/g, " ")),

  age: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tuổi")
    .regex(/^\d{1,3}$/, "Tuổi phải là số nguyên")
    .transform((value) => Number(value))
    .refine(
      (value) => value >= MIN_USER_AGE && value <= MAX_USER_AGE,
      `Tuổi phải từ ${MIN_USER_AGE} đến ${MAX_USER_AGE}`,
    ),

  // Chưa chọn thì giá trị là "" nên phải chặn rỗng TRƯỚC khi so với enum: message mặc định
  // của enum ("Invalid option") không nói được gì cho người dùng. `.pipe` giữ output là
  // union Gender chứ không phải string, nên payload gửi BE vẫn đúng kiểu.
  gender: z.string().min(1, "Vui lòng chọn giới tính").pipe(genderSchema),

  phone: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số điện thoại")
    .transform(normalizeVietnamPhone)
    .refine(
      (value) => VN_MOBILE_PHONE_REGEX.test(value),
      "Số điện thoại phải là số di động Việt Nam (vd 0912345678)",
    ),
})
