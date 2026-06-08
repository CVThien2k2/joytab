import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/api/auth-server"

const SESSION_COOKIE_NAME = "session_id"

/**
 * Input: Nội dung các route private.
 * Output: Server Component gate (user đã hydrate vào store ở root layout):
 *  - hợp lệ → render children.
 *  - không lấy được nhưng CÒN cookie → null; popup hết phiên do AuthProvider (global) lo.
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
  if (!hasSessionCookie) {
    redirect("/login")
  }

  return null
}
