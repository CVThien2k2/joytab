import { z } from "zod"
import { profileFormSchema, updateProfileSchema } from "@/schema/profile"

/** Giá trị form (age là chuỗi user gõ) — xem lý do ở types/onboarding.ts. */
export type ProfileFormValues = z.input<typeof profileFormSchema>

/** Giá trị sau validate: age đã thành number, phone đã chuẩn hoá. */
export type ProfileFormPayload = z.infer<typeof profileFormSchema>

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>
