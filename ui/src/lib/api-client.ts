import axios from "axios"
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios"
import { z } from "zod"
import { isAccessTokenExpired, useAuthStore } from "@/stores/auth-store"
import { refreshDataSchema } from "@/lib/auth-callback"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  _accountId?: string
}

const refreshResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: refreshDataSchema,
})

// Deduplicated per-account refresh promises — avoids concurrent refresh on same account.
const refreshPromises = new Map<string, Promise<string>>()

/**
 * Input: accountId của account cần refresh.
 * Output: Gọi BE /auth/refresh, cập nhật access token mới vào store, trả token mới.
 */
async function runRefresh(accountId: string): Promise<string> {
  const response = await axios.post(
    new URL("/auth/refresh", API_BASE_URL).toString(),
    { accountId },
    { withCredentials: true },
  )
  const parsed = refreshResponseSchema.safeParse(response.data)
  if (!parsed.success) throw new Error("Invalid refresh response")
  const { userId, accessToken, accessTokenExpiresAt } = parsed.data.data
  useAuthStore.getState().updateAccessToken(userId, accessToken, accessTokenExpiresAt)
  return accessToken
}

/**
 * Input: accountId của account đang active.
 * Output: Access token còn hạn; nếu token thiếu/hết hạn thì refresh đúng account trước khi trả token.
 */
async function getUsableAccessToken(accountId: string): Promise<string | null> {
  const session = useAuthStore.getState().accounts[accountId]
  if (!session) {
    return null
  }
  if (!isAccessTokenExpired(session.accessTokenExpiresAt)) {
    return session.accessToken
  }
  return refreshForAccount(accountId)
}

/**
 * Input: accountId của account cần refresh.
 * Output: Trả promise refresh đã có (nếu đang chạy) hoặc tạo mới; xóa khỏi map khi hoàn thành.
 */
function refreshForAccount(accountId: string): Promise<string> {
  let p = refreshPromises.get(accountId)
  if (!p) {
    p = runRefresh(accountId).finally(() => refreshPromises.delete(accountId))
    refreshPromises.set(accountId, p)
  }
  return p
}

/**
 * Input: URL của request lỗi 401.
 * Output: true nếu là endpoint tự quản lý token, không được refresh để tránh đệ quy.
 */
function isAuthBootstrapUrl(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  return url.includes("/auth/refresh") || url.includes("/auth/google/exchange")
}

/**
 * Input: Không nhận input runtime; sử dụng biến môi trường NEXT_PUBLIC_API_BASE_URL.
 * Output: Tạo axios instance dùng chung, tự gắn Bearer token và auto-refresh khi 401.
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  })

  instance.interceptors.request.use(
    /**
     * Input: Request config trước khi gửi ra mạng.
     * Output: Gắn Authorization: Bearer <accessToken> và stamp _accountId nếu đang có active account với token.
     */
    async (config: InternalAxiosRequestConfig) => {
      if (isAuthBootstrapUrl(config.url)) {
        return config
      }
      const { activeAccountId } = useAuthStore.getState()
      const accessToken = activeAccountId ? await getUsableAccessToken(activeAccountId) : null
      if (activeAccountId && accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
        ;(config as RetryableRequestConfig)._accountId = activeAccountId
      }
      return config
    },
  )

  instance.interceptors.response.use(
    (response) => response,
    /**
     * Input: Lỗi response từ BE.
     * Output: Với 401 (lần đầu), refresh token của account đã stamp rồi retry;
     *         refresh fail thì remove đúng account đó và về /login nếu không còn account nào.
     */
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error)
      }

      const config = error.config as RetryableRequestConfig | undefined
      const status = error.response?.status

      if (
        status !== 401 ||
        !config ||
        config._retry ||
        isAuthBootstrapUrl(config.url)
      ) {
        return Promise.reject(error)
      }

      const accountId = config._accountId
      if (!accountId) return Promise.reject(error)

      config._retry = true

      try {
        const newAccessToken = await refreshForAccount(accountId)
        config.headers.Authorization = `Bearer ${newAccessToken}`
        return instance(config)
      } catch (refreshError) {
        useAuthStore.getState().removeAccount(accountId)
        if (typeof window !== "undefined" && !useAuthStore.getState().activeAccountId) {
          window.location.href = "/login"
        }
        return Promise.reject(refreshError)
      }
    },
  )

  return instance
}

export const apiClient = createApiClient()
