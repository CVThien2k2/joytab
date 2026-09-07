import { NextResponse, type NextRequest } from "next/server"

/** Tên cookie do BE set (api/src/auth/auth.constants.ts) — FE không import được nên khai lại. */
const REFRESH_COOKIE = "rt"
/** Có cookie này = user chưa onboarding xong. BE set/xoá ở mọi lần login, refresh, onboarding. */
const ONBOARDING_COOKIE = "onb"
/**
 * Cờ do trang /logout đặt (cookie THƯỜNG, không httpOnly, tự hết sau 30 giây). Đăng xuất mà
 * BE lỗi thì `rt` còn nguyên; không có cờ này, luật "còn `rt` thì đá khỏi /login" sẽ ném
 * người dùng ngược về `/` và không bao giờ ra được trang đăng nhập.
 */
const LOGOUT_MARK = "logged_out"

const LOGIN_PATH = "/login"
const ONBOARDING_PATH = "/onboarding"
/** Lối thoát khi cắt phiên — xem app/logout/page.tsx. Không bao giờ được chặn. */
const LOGOUT_PATH = "/logout"
const HOME_PATH = "/"
/** Tên query mang đích cần quay lại sau khi đăng nhập / khai xong thông tin. */
const NEXT_PARAM = "next"

export const config = {
  // Bỏ qua asset và route nội bộ của Next để proxy chỉ chạy cho trang thật.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webmanifest)$).*)",
  ],
}

/**
 * Input: Request tới bất kỳ trang nào.
 * Output: Gác cổng, CHỈ đọc cookie và CHỈ để định hướng nhanh:
 *  - /logout → luôn cho qua.
 *  - Không có `rt` → về /login (đang ở /login thì cho qua).
 *  - Đang đăng xuất (có cờ `logged_out`) → cho qua, không đá đi đâu.
 *  - Có `onb` (chưa khai đủ thông tin) → ép về /onboarding, chỉ /onboarding vào được.
 *  - Không có `onb` mà đang ở /onboarding hoặc /login → về `/`.
 *  - Còn lại → cho đi.
 *
 * KHÔNG gọi BE ở đây (trước đây có: `at` mất thì proxy tự gọi /auth/refresh). Gác cổng mà đi
 * gọi API thì BE chậm là mọi trang chậm theo, BE hỏng là cả site đá vòng. Việc token còn hạn
 * hay không thuộc về apiClient: 401 giữa phiên → nó xoay token tại chỗ rồi chạy lại đúng
 * request đó, xoay hỏng thì đưa về /logout (xem api/client.ts).
 *
 * Hai cookie trên là toàn bộ luật điều hướng theo phiên. Chúng là GỢI Ý, không phải nguồn sự
 * thật: `onb` bị xoá tay chỉ khiến user đi sai một nhịp rồi tự đúng ở lượt gọi kế tiếp, vì
 * BE ghi lại cờ ở mọi lần login/refresh/onboarding.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Lối thoát khi phiên chết: kể cả `rt` đã hỏng vẫn phải vào được đây để cắt cookie.
  if (pathname === LOGOUT_PATH) return NextResponse.next()

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  const isLoginPage = pathname === LOGIN_PATH
  const isOnboardingPage = pathname === ONBOARDING_PATH

  if (!refreshToken) {
    return isLoginPage ? NextResponse.next() : redirectTo(request, LOGIN_PATH, pathname)
  }

  // Vừa bấm đăng xuất mà BE chưa kịp xoá cookie: cho đi tới nơi trang /logout muốn tới.
  if (request.cookies.has(LOGOUT_MARK)) return NextResponse.next()

  if (request.cookies.has(ONBOARDING_COOKIE)) {
    return isOnboardingPage
      ? NextResponse.next()
      : // Giữ đích qua bước khai thông tin: user bấm link mời khi chưa onboarding thì khai
        // xong phải về đúng link đó, không rơi về `/`.
        redirectTo(request, ONBOARDING_PATH, pathname)
  }

  if (isOnboardingPage || isLoginPage) return redirectTo(request, HOME_PATH)

  return NextResponse.next()
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
