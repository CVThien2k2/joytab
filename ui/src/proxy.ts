import { NextResponse, type NextRequest } from "next/server"

/** Tên 2 cookie do BE set (api/src/auth/auth.constants.ts) — FE không import được nên khai lại. */
const ACCESS_COOKIE = "at"
const REFRESH_COOKIE = "rt"

const LOGIN_PATH = "/login"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"

export const config = {
  // Bỏ qua asset và route nội bộ của Next để proxy chỉ chạy cho trang thật.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webmanifest)$).*)"],
}

/**
 * Input: Request tới bất kỳ trang nào.
 * Output: Cửa duy nhất quyết định vào được hay không, dựa trên cookie:
 *  - Không có `rt` → về /login ngay (trừ khi đang ở /login).
 *  - Có `rt` mà đang ở /login → về `/`.
 *  - Có cả `rt` và `at` → cho đi.
 *  - Có `rt` nhưng mất `at` (cookie `at` có maxAge 1 giờ nên browser tự bỏ khi hết hạn)
 *    → refresh ngay tại đây rồi mới render.
 *
 * Client KHÔNG còn giữ user ở localStorage: cookie httpOnly là nguồn sự thật duy nhất,
 * nên chỗ chặn phải nằm ở proxy chứ không phải ở component.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH

  if (!refreshToken) {
    return isLoginPage ? NextResponse.next() : redirectTo(request, LOGIN_PATH)
  }
  if (isLoginPage) {
    return redirectTo(request, "/")
  }
  if (request.cookies.get(ACCESS_COOKIE)) {
    return NextResponse.next()
  }

  return refreshAtProxy(request, refreshToken)
}

/**
 * Input: Request hiện tại + refresh token còn sống.
 * Output: Gọi BE /auth/refresh, gắn cookie mới vào response VÀ bơm vào chính request này
 *         để server component render ngay lượt này đã có `at` hợp lệ.
 *         Refresh fail (RT hết hạn / bị revoke / phát hiện reuse) → xoá cookie, về /login.
 */
async function refreshAtProxy(request: NextRequest, refreshToken: string): Promise<NextResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
  })

  if (!response.ok) {
    const redirect = redirectTo(request, LOGIN_PATH)
    redirect.cookies.delete(ACCESS_COOKIE)
    redirect.cookies.delete(REFRESH_COOKIE)
    return redirect
  }

  const setCookies = response.headers.getSetCookie()
  const headers = new Headers(request.headers)
  headers.set("cookie", mergeCookieHeader(request.headers.get("cookie"), setCookies))

  const next = NextResponse.next({ request: { headers } })
  for (const cookie of setCookies) {
    next.headers.append("set-cookie", cookie)
  }
  return next
}

/**
 * Input: Header `cookie` hiện tại và danh sách `set-cookie` vừa nhận từ BE.
 * Output: Header cookie đã ghi đè cặp at/rt mới, giữ nguyên các cookie khác.
 */
function mergeCookieHeader(currentCookie: string | null, setCookies: string[]): string {
  const jar = new Map<string, string>()
  for (const pair of currentCookie?.split(";") ?? []) {
    const [name, ...value] = pair.trim().split("=")
    if (name) jar.set(name, value.join("="))
  }
  for (const rawSetCookie of setCookies) {
    const [name, ...value] = rawSetCookie.split(";")[0].split("=")
    if (name) jar.set(name.trim(), value.join("="))
  }
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ")
}

/**
 * Input: Request hiện tại và path đích.
 * Output: Redirect 307 tới path đó, bỏ query của request cũ.
 */
function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  return NextResponse.redirect(url)
}
