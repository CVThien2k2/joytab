import { redirect } from "next/navigation"
import { getCurrentUser } from "@/api/auth-server"

/**
 * Input: Nội dung các route private cần đăng nhập trong App Router.
 * Output: Server Component — validate session ở server (DAL getCurrentUser → API /auth/me).
 *         Không hợp lệ → redirect /login trước khi render; hợp lệ → render children.
 */
export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return children
}
