import { cookies } from "next/headers"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"

/** Lấy được user thì `error` null, ngược lại `user` null và `error` là lý do để hiện ra màn hình. */
export type CurrentUserResult = { user: CurrentUser; error: null } | { user: null; error: string }

/**
 * Input: Không nhận tham số; đọc cookie của request hiện tại.
 * Output: User từ BE hoặc lý do thất bại. CHỈ chạy trên Next server (dùng next/headers)
 *         nên cookie httpOnly phải forward tay — fetch phía server không có browser gửi hộ.
 *         Không throw: layout cần hiện lỗi chứ không cần error boundary.
 */
export async function fetchCurrentUser(): Promise<CurrentUserResult> {
  const cookieStore = await cookies()
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    })
    if (!response.ok) {
      return { user: null, error: `GET ${API_BASE_URL}/auth/me → ${response.status}` }
    }
    return { user: meResponseSchema.parse(await response.json()).data, error: null }
  } catch (err) {
    return { user: null, error: describeError(err) }
  }
}

/**
 * Input: Lỗi bất kỳ từ fetch/zod.
 * Output: Chuỗi có kèm `cause` — fetch của undici chỉ trả "fetch failed", nguyên nhân thật
 *         (ECONNREFUSED khi BE chưa chạy) nằm trong cause.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = err.cause
  if (cause instanceof Error) return `${err.message} (${cause.message})`
  return err.message
}
