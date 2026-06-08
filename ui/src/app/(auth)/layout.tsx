import { redirect } from "next/navigation"
import { getCurrentUser } from "@/api/auth-server"
import { AuthHeader } from "./_components/auth-header"

/**
 * Input: Nội dung các route auth (login).
 * Output: Server Component. Nếu session HỢP LỆ (getCurrentUser) → đã đăng nhập, đá về `/`.
 *         Cookie hỏng/không có vẫn vào được /login để đăng nhập lại (gate theo session hợp lệ, không phải cookie-presence).
 *         Thêm tài khoản đi thẳng OAuth (/auth/google), không qua route này.
 */
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  if (user) {
    redirect("/")
  }
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthHeader />
      {children}
    </div>
  )
}
