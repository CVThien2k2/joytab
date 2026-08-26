import { z } from "zod"
import { GENDERS } from "@/schema/auth"
import { onboardingFormSchema } from "@/schema/onboarding"

export type Gender = (typeof GENDERS)[number]

/**
 * Giá trị các field trong form — tất cả là string vì input/select HTML chỉ trả string.
 * Đây là kiểu dùng cho useForm/defaultValues.
 */
export type OnboardingFormValues = z.input<typeof onboardingFormSchema>

/**
 * Payload gửi POST /auth/onboarding — `age` đã là number, `gender` đã là union, `phone` đã
 * chuẩn hoá. Là kết quả sau khi schema transform, tức thứ handleSubmit nhận được.
 */
export type OnboardingPayload = z.output<typeof onboardingFormSchema>
