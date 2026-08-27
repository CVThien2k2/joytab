import { z } from "zod"
import { onboardingFormSchema } from "@/schema/onboarding"

/**
 * Form sửa thông tin cá nhân. Dùng LẠI nguyên schema của onboarding: cùng bốn field, cùng luật
 * validate, nên tách ra hai bộ luật là mở đường cho chúng lệch nhau.
 *
 * Vẫn bắt buộc cả bốn field (dù BE cho phép gửi thiếu): người vào được trang này đã onboarding
 * xong nên bốn field đều đang có giá trị — cho phép xoá trắng chỉ tạo ra user thiếu dữ liệu.
 */
export const profileFormSchema = onboardingFormSchema

/** Payload gửi PATCH /auth/me. `avatarUrl` tách riêng vì nó đổi bằng nút, không qua form. */
export const updateProfileSchema = profileFormSchema.partial().extend({
  avatarUrl: z.string().nullable().optional(),
})
