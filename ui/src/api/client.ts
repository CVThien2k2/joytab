import axios from "axios"
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios"
import { useAuthStore } from "@/stores/auth-store"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

/** Endpoint refresh — không bao giờ được tự refresh lại chính nó (vòng lặp vô hạn). */
const REFRESH_URL = "/auth/refresh"

/** Access token hết hạn — mã DUY NHẤT đáng để thử refresh. */
const ACCESS_TOKEN_EXPIRED_CODE = "AUTH_005"

/** Đánh dấu request đã retry sau refresh, để không retry lần hai. */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

/**
 * Input: Không nhận input runtime; dùng NEXT_PUBLIC_API_BASE_URL.
 * Output: axios instance dùng chung — luôn gửi kèm cookie `at`/`rt` (withCredentials).
 *
 * Xử lý 401:
 *  - code AUTH_005 (AT hết hạn) → gọi /auth/refresh rồi retry đúng request đó một lần.
 *  - code khác (AUTH_001 token rác/thiếu, AUTH_006 RT chết) → clear store, về /login.
 *  - Riêng /auth/me và /auth/refresh: để caller tự quyết (trang /auth/callback tự điều hướng).
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    withCredentials: true,
  })

  /**
   * Promise refresh đang bay (single-flight).
   *
   * Nhiều request song song cùng nhận 401 sẽ cùng await một promise thay vì mỗi cái gọi
   * /auth/refresh một lần. Bắt buộc phải vậy vì refresh token xoay vòng: hai lần refresh
   * đồng thời thì lần thứ hai dùng RT đã bị revoke → BE coi là token reuse và revoke sạch
   * toàn bộ token của user, đăng xuất oan.
   */
  let refreshPromise: Promise<void> | null = null

  /**
   * Input: Không nhận tham số.
   * Output: Gọi /auth/refresh đúng một lần cho mọi caller đồng thời.
   */
  function refreshOnce(): Promise<void> {
    refreshPromise ??= instance
      .post(REFRESH_URL)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
    return refreshPromise
  }

  /**
   * Input: Không nhận tham số.
   * Output: Xoá user khỏi store (kèm localStorage) và đưa browser về /login.
   */
  function forceLogin(): void {
    useAuthStore.getState().clearUser()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        return Promise.reject(error)
      }

      const config = error.config as RetriableConfig | undefined
      const url = config?.url ?? ""

      // /auth/refresh và /auth/me tự chịu trách nhiệm: refresh thất bại thì không có gì
      // để thử lại, còn /auth/me chỉ được gọi ở trang callback và trang đó tự điều hướng.
      if (url.includes(REFRESH_URL) || url.includes("/auth/me")) {
        return Promise.reject(error)
      }

      const code = (error.response.data as { code?: string } | undefined)?.code
      if (code !== ACCESS_TOKEN_EXPIRED_CODE) {
        forceLogin()
        return Promise.reject(error)
      }

      if (!config || config._retried) {
        forceLogin()
        return Promise.reject(error)
      }

      try {
        await refreshOnce()
      } catch {
        forceLogin()
        return Promise.reject(error)
      }

      config._retried = true
      return instance.request(config as AxiosRequestConfig)
    },
  )

  return instance
}

export const apiClient = createApiClient()
