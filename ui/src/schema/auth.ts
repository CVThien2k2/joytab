import { z } from "zod"
import { envelope } from "@/schema/envelope"

export const userSchema = z.object({
  provider: z.literal("google"),
  providerUserId: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

/** Shape dùng chung cho GET /auth/me và POST /auth/refresh. */
export const meResponseSchema = envelope(z.object({ userId: z.string(), user: userSchema }))
