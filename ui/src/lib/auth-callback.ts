import { z } from "zod"

const googleCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
})

const exchangeResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    accessToken: z.string().min(1),
    accessTokenExpiresAt: z.string().min(1),
    user: z.object({
      provider: z.literal("google"),
      providerUserId: z.string().min(1),
      email: z.string().min(1),
      emailVerified: z.boolean(),
      fullName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
  }),
})

export type AuthSession = z.infer<typeof exchangeResponseSchema>["data"]

/**
 * Input: Chuỗi query string lấy từ URL hiện tại sau khi BE callback về FE.
 * Output: Trả mã callback code nếu query hợp lệ; ngược lại trả null.
 */
export function parseGoogleLoginCallbackCode(queryString: string): string | null {
  const rawParams = Object.fromEntries(new URLSearchParams(queryString).entries())
  const parsedResult = googleCallbackQuerySchema.safeParse(rawParams)

  if (!parsedResult.success) {
    return null
  }

  return parsedResult.data.code ?? null
}

/**
 * Input: Payload response từ endpoint exchange code của BE.
 * Output: Trả session đã validate nếu đúng schema; sai schema thì trả null.
 */
export function parseGoogleLoginExchangeResponse(payload: unknown): AuthSession | null {
  const parsedResult = exchangeResponseSchema.safeParse(payload)
  if (!parsedResult.success) {
    return null
  }

  return parsedResult.data.data
}
