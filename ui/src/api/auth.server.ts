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
      const code = await readErrorCode(response)
      return { user: null, error: `Không lấy được thông tin tài khoản (${code})` }
    }
    return { user: meResponseSchema.parse(await response.json()).data, error: null }
  } catch (err) {
    return { user: null, error: describeError(err) }
  }
}

/**
 * Input: Response lỗi từ BE.
 * Output: Mã lỗi nghiệp vụ (vd AUTH_001) để hiện kèm câu tiếng Việt; không đọc được thì lấy
 *         HTTP status. Người dùng đọc câu chữ, còn mã là thứ để đối chiếu với log.
 */
async function readErrorCode(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { code?: string } | null
  return body?.code ?? String(response.status)
}

/**
 * Input: Lỗi bất kỳ từ fetch/zod.
 * Output: Chuỗi có kèm `cause` — fetch của undici chỉ trả "fetch failed", nguyên nhân thật
 *         (ECONNREFUSED khi BE chưa chạy) nằm trong cause.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return `Không gọi được máy chủ: ${String(err)}`
  const cause = err.cause
  if (cause instanceof Error) return `Không gọi được máy chủ: ${err.message} (${cause.message})`
  return `Không gọi được máy chủ: ${err.message}`
}
