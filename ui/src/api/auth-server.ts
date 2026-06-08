import { cookies } from "next/headers"
import { cache } from "react"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"

// URL gọi API từ phía server Next (có thể là URL nội bộ ở prod); fallback về public base URL.
const SERVER_API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"

/**
 * Input: Không nhận tham số; đọc cookie request hiện tại qua next/headers.
 * Output: Thông tin user nếu session hợp lệ (gọi API /auth/me, forward cookie), ngược lại null.
 *         Đây là ranh giới validate THẬT ở server (DAL). cache() để mỗi request render chỉ gọi API 1 lần.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) {
    return null
  }
  try {
    const response = await fetch(new URL("/auth/me", SERVER_API_BASE_URL), {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    })
    if (!response.ok) {
      return null
    }
    return meResponseSchema.parse(await response.json()).data
  } catch {
    return null
  }
})
