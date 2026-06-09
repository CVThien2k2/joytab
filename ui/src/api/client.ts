import axios from "axios"
import type { AxiosInstance } from "axios"

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
 *         401 ở API nghiệp vụ thì redirect /switch-account (đồng bộ với SSR), 401 ở /auth/* để caller tự quyết.
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
        // Hết phiên ở bất kỳ page nào → cùng một cửa như SSR: trang /switch-account.
        window.location.href = "/switch-account?reason=revoked"
      }
      return Promise.reject(error)
    },
  )

  return instance
}

export const apiClient = createApiClient()
