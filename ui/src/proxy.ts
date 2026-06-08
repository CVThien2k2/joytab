import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE_NAME = "session_id"

// Route public (không cần đăng nhập). Group route Next không đổi URL nên match theo path thật.
const PUBLIC_PATHS = ["/login"]

/**
 * Input: Request đến (Next 16 Proxy — tên mới của middleware).
 * Output: OPTIMISTIC check — route không public mà thiếu cookie session_id thì redirect /login sớm.
 *         Đây KHÔNG phải ranh giới bảo mật: validate thật do DAL getCurrentUser ở (private)/layout đảm nhiệm.
 *         Không đá người đã đăng nhập khỏi /login để vẫn cho thêm tài khoản.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
  const hasSession = req.cookies.has(SESSION_COOKIE_NAME)

  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
