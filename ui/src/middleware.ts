import { NextResponse, type NextRequest } from "next/server"

const REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
const LOGIN_PATH = "/login"
const HOME_PATH = "/"

/**
 * Input: Pathname đang điều hướng tới.
 * Output: true nếu pathname thuộc nhóm public (login + callback), không cần auth.
 */
function isPublicAuthPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith("/login/")
}

/**
 * Input: Request đi vào Next, đã được matcher lọc các tài nguyên tĩnh.
 * Output: Redirect về `/login` nếu thiếu session cookie ở protected; redirect `/` nếu đã có cookie mà vào public; ngược lại next().
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(REFRESH_TOKEN_COOKIE_NAME)
  const isPublic = isPublicAuthPath(pathname)

  if (!hasSession && !isPublic) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = LOGIN_PATH
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (hasSession && pathname === LOGIN_PATH) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = HOME_PATH
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/).*)"],
}
