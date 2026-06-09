import axios from "axios"
import type { AxiosInstance } from "axios"
import { useAuthStore } from "@/stores/auth-store"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

/**
 * Input: URL của request.
 * Output: true nếu là endpoint /auth/* — caller tự xử lý 401 (switch/me/accounts), không hard-redirect.
 */
function isAuthControlUrl(url: string | undefined): boolean {
  return Boolean(url && url.includes("/auth/"))
}

/**
 * Input: Không nhận input runtime; dùng NEXT_PUBLIC_API_BASE_URL.
 * Output: axios instance dùng chung — luôn gửi kèm cookie session (withCredentials);
 *         401 ở API nghiệp vụ: AUTH_004 (revoked) → bật popup qua store, còn lại → /login.
 *         401 ở /auth/* để caller tự quyết (AppWrapper xử lý /auth/me).
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    withCredentials: true,
  })

  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !isAuthControlUrl(error.config?.url) &&
        typeof window !== "undefined"
      ) {
        const code = (error.response.data as { code?: string } | undefined)?.code
        if (code === "AUTH_004") {
          useAuthStore.setState({ revoked: true })
        } else {
          window.location.href = "/login"
        }
      }
      return Promise.reject(error)
    },
  )

  return instance
}

export const apiClient = createApiClient()
