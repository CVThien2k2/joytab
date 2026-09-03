import { NextResponse, type NextRequest } from "next/server"

/** Tên 3 cookie do BE set (api/src/auth/auth.constants.ts) — FE không import được nên khai lại. */
const ACCESS_COOKIE = "at"
const REFRESH_COOKIE = "rt"
/** Có cookie này = user chưa onboarding xong. BE set/xoá ở mọi lần login, refresh, onboarding. */
const ONBOARDING_COOKIE = "onb"

const LOGIN_PATH = "/login"
/** Tên query mang đích cần quay lại sau khi đăng nhập / khai xong thông tin. */
const NEXT_PARAM = "next"
const ONBOARDING_PATH = "/onboarding"
const HOME_PATH = "/"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"

export const config = {
  // Bỏ qua asset và route nội bộ của Next để proxy chỉ chạy cho trang thật.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webmanifest)$).*)",
  ],
}

/**
 * Input: Request tới bất kỳ trang nào.
 * Output: Cửa duy nhất quyết định vào được hay không, dựa trên cookie:
 *  - Không có `rt` → về /login ngay (trừ khi đang ở /login).
 *  - Có `rt` mà mất `at` (cookie `at` maxAge 1 giờ nên browser tự bỏ khi hết hạn)
 *    → refresh ngay tại đây rồi mới quyết định đi đâu.
 *  - Có `onb` (chưa khai đủ thông tin) → ép về /onboarding, chỉ /onboarding vào được.
 *  - Không có `onb` mà đang ở /onboarding hoặc /login → về `/`.
 *  - Còn lại → cho đi.
 *
 * Thứ tự "refresh trước, xét onboarding sau" là bắt buộc: response của /auth/refresh mang
 * theo cookie `onb` mới nhất, xét trước khi refresh thì đang dùng cờ của phiên cũ.
 *
 * Client KHÔNG giữ user ở localStorage: cookie httpOnly là nguồn sự thật duy nhất, nên chỗ
 * chặn phải nằm ở proxy chứ không phải ở component.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH

  if (!refreshToken) {
    return isLoginPage
      ? NextResponse.next()
      : redirectTo(request, LOGIN_PATH, request.nextUrl.pathname)
  }
  if (!request.cookies.get(ACCESS_COOKIE)) {
    return refreshAtProxy(request, refreshToken)
  }

  return routeByOnboarding(request, request.cookies.get(ONBOARDING_COOKIE) !== undefined)
}

/**
 * Input: Request đã có phiên hợp lệ + user còn chờ onboarding hay không.
 * Output: Điều hướng theo đúng một quy tắc: chưa xong chỉ được ở /onboarding, xong rồi thì
 *         /onboarding và /login đều đá về `/`.
 *
 *         Tách riêng vì phải gọi từ hai chỗ (đường thường và đường vừa refresh) với cờ đến
 *         từ hai nguồn khác nhau — cookie của request, hoặc set-cookie của /auth/refresh.
 */
function routeByOnboarding(
  request: NextRequest,
  needsOnboarding: boolean,
  response?: NextResponse,
): NextResponse {
  const { pathname } = request.nextUrl
  const isOnboardingPage = pathname === ONBOARDING_PATH
  const isLoginPage = pathname === LOGIN_PATH

  if (needsOnboarding) {
    return isOnboardingPage
      ? (response ?? NextResponse.next())
      : // Giữ đích qua bước khai thông tin: user bấm link mời khi chưa onboarding thì khai
        // xong phải về đúng link đó, không rơi về `/`.
        redirectTo(request, ONBOARDING_PATH, pathname)
  }
  if (isOnboardingPage || isLoginPage) {
    return redirectTo(request, HOME_PATH)
  }
  return response ?? NextResponse.next()
}

/**
 * Input: Request hiện tại + refresh token còn sống.
 * Output: Gọi BE /auth/refresh, gắn cookie mới vào response VÀ bơm vào chính request này
 *         để server component render ngay lượt này đã có `at` hợp lệ, rồi mới xét onboarding
 *         theo cờ vừa nhận.
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
    redirect.cookies.delete(ONBOARDING_COOKIE)
    return redirect
  }

  const setCookies = response.headers.getSetCookie()
  const headers = new Headers(request.headers)
  headers.set("cookie", mergeCookieHeader(request.headers.get("cookie"), setCookies))

  const next = NextResponse.next({ request: { headers } })
  for (const cookie of setCookies) {
    next.headers.append("set-cookie", cookie)
  }

  const routed = routeByOnboarding(request, hasPendingOnboarding(setCookies), next)
  // Redirect thì `next` bị bỏ, phải chuyển set-cookie sang response mới — nếu không, lần sau
  // browser vẫn gửi `at` cũ đã hết hạn và ta refresh lại từ đầu ở mỗi request.
  if (routed !== next) {
    for (const cookie of setCookies) {
      routed.headers.append("set-cookie", cookie)
    }
  }
  return routed
}

/**
 * Input: Danh sách set-cookie từ /auth/refresh.
 * Output: true nếu BE vừa SET cookie `onb` (còn chờ onboarding).
 *
 *         Phân biệt set với clear bằng chính giá trị: BE clear bằng cách set giá trị rỗng +
 *         Expires quá khứ, nên `onb=` (rỗng) phải hiểu là "đã xong", không phải "đang chờ".
 */
function hasPendingOnboarding(setCookies: string[]): boolean {
  for (const rawSetCookie of setCookies) {
    const [name, ...value] = rawSetCookie.split(";")[0].split("=")
    if (name.trim() === ONBOARDING_COOKIE) return value.join("=").trim().length > 0
  }
  return false
}

/**
 * Input: Header `cookie` hiện tại và danh sách `set-cookie` vừa nhận từ BE.
 * Output: Header cookie đã ghi đè các cặp mới, giữ nguyên các cookie khác. Cookie bị BE clear
 *         (giá trị rỗng) thì bỏ hẳn khỏi header chứ không để lại `onb=` — server component
 *         đọc `onb=` rỗng dễ tưởng là còn cờ.
 */
function mergeCookieHeader(currentCookie: string | null, setCookies: string[]): string {
  const jar = new Map<string, string>()
  for (const pair of currentCookie?.split(";") ?? []) {
    const [name, ...value] = pair.trim().split("=")
    if (name) jar.set(name, value.join("="))
  }
  for (const rawSetCookie of setCookies) {
    const [name, ...value] = rawSetCookie.split(";")[0].split("=")
    if (!name) continue
    const cookieName = name.trim()
    const cookieValue = value.join("=")
    if (cookieValue.length === 0) jar.delete(cookieName)
    else jar.set(cookieName, cookieValue)
  }
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ")
}

/**
 * Input: Request hiện tại, path đích, và (tuỳ chọn) path người dùng đang muốn tới.
 * Output: Redirect 307 tới path đó, bỏ query của request cũ.
 *
 *         `returnTo` chỉ gắn khi nó là một trang thật đáng quay lại — `/` là mặc định sau
 *         đăng nhập rồi nên gắn vào chỉ tổ làm URL dài. Giá trị đi tiếp tới /auth/google và
 *         quay về qua Google, BE lọc lại lần nữa trước khi redirect (sanitizeReturnToPath).
 */
function redirectTo(request: NextRequest, pathname: string, returnTo?: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""
  if (returnTo && returnTo !== HOME_PATH && returnTo !== pathname) {
    url.searchParams.set(NEXT_PARAM, returnTo)
  }
  return NextResponse.redirect(url)
}
