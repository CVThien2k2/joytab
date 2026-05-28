import axios from "axios"
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios"

/**
 * Input: Không nhận input runtime; mọi call dùng đường dẫn tương đối qua Next rewrite.
 * Output: Tạo axios instance same-origin để cookie httpOnly thuộc FE host được gửi tự động.
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: "",
    timeout: 10000,
    withCredentials: true,
  })

  instance.interceptors.request.use(
    /**
     * Input: Request config trước khi gửi ra mạng.
     * Output: Trả nguyên config để mở rộng interceptor sau này (token/header).
     */
    (config: InternalAxiosRequestConfig) => config,
  )

  return instance
}

export const apiClient = createApiClient()

