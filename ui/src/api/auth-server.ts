import { cookies } from "next/headers"
import { cache } from "react"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"

const SESSION_COOKIE_NAME = "session_id"

// URL gọi API từ phía server Next (có thể là URL nội bộ ở prod); fallback về public base URL.
const SERVER_API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"

export type AuthState = {
  /** User nếu session hợp lệ, ngược lại null. */
  user: CurrentUser | null
  /** Còn cookie session nhưng /auth/me trả 401 → session hết hạn/bị thu hồi. */
  isExpired: boolean
  /** Gọi /auth/me thất bại do lỗi (mạng / 5xx), không phải hết hạn. */
  isError: boolean
}

const UNAUTHENTICATED: AuthState = { user: null, isExpired: false, isError: false }

/**
 * Input: Không nhận tham số; đọc cookie request hiện tại qua next/headers.
 * Output: Trạng thái auth (DAL — ranh giới validate THẬT ở server). cache() để mỗi request render chỉ gọi API 1 lần.
 *  - không cookie → chưa đăng nhập.
 *  - cookie + 200 → user.
 *  - cookie + 401 → isExpired.
 *  - cookie + lỗi khác → isError.
 */
export const getCurrentUser = cache(async (): Promise<AuthState> => {
  const cookieStore = await cookies()
  if (!cookieStore.has(SESSION_COOKIE_NAME)) {
    return UNAUTHENTICATED
  }
  try {
    const response = await fetch(new URL("/auth/me", SERVER_API_BASE_URL), {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    })
    if (response.status === 401) {
      return { user: null, isExpired: true, isError: false }
    }
    if (!response.ok) {
      return { user: null, isExpired: false, isError: true }
    }
    const user = meResponseSchema.parse(await response.json()).data
    return { user, isExpired: false, isError: false }
  } catch {
    return { user: null, isExpired: false, isError: true }
  }
})
