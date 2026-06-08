import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/api/auth-server"
import { SessionExpiredDialog } from "./_components/session-expired-dialog"

const SESSION_COOKIE_NAME = "session_id"

/**
 * Input: Nội dung các route private.
 * Output: Server Component gate (user đã được hydrate vào store ở root layout):
 *  - hợp lệ → render children.
 *  - không lấy được nhưng CÒN cookie session → popup hết phiên + nút đăng xuất.
 *  - không cookie → redirect /login.
 */
export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  if (user) {
    return children
  }

  const hasSessionCookie = (await cookies()).has(SESSION_COOKIE_NAME)
  if (hasSessionCookie) {
    return <SessionExpiredDialog />
  }

  redirect("/login")
}
