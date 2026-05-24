import axios from "axios"
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

/**
 * Input: Không nhận input runtime; sử dụng biến môi trường NEXT_PUBLIC_API_BASE_URL.
 * Output: Tạo axios instance dùng chung cho toàn bộ request từ UI sang BE.
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
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

