import { z } from "zod"

const googleCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
})

const exchangeResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    accessTokenExpiresAt: z.string().min(1),
    refreshTokenExpiresAt: z.string().min(1),
    user: z.object({
      userId: z.string().min(1),
      email: z.string().min(1),
      fullName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      provider: z.string().min(1),
      providerUserId: z.string().min(1),
      lastLoginAt: z.string().nullable(),
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
