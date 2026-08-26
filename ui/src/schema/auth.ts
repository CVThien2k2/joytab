import { z } from "zod"
import { envelope } from "@/schema/envelope"

/** Khớp GENDERS ở BE (api/src/common/utils/types.ts). */
export const GENDERS = ["male", "female", "other"] as const

export const genderSchema = z.enum(GENDERS)

export const userSchema = z.object({
  provider: z.literal("google"),
  providerUserId: z.string(),
  email: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** Phần user tự khai ở onboarding — null với user chưa xác nhận thông tin. */
  age: z.number().nullable(),
  gender: genderSchema.nullable(),
  phone: z.string().nullable(),
  /** false = chưa xác nhận đủ thông tin, phải qua /onboarding trước khi vào app. */
  onboarded: z.boolean(),
})

/** Shape dùng chung cho GET /auth/me, POST /auth/refresh và POST /auth/onboarding. */
export const meResponseSchema = envelope(z.object({ userId: z.string(), user: userSchema }))
