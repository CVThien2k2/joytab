import { redirect } from "next/navigation"
import { getCurrentUser } from "@/api/auth-server"

/**
 * Input: Nội dung các route private.
 * Output: Server Component gate (user đã hydrate vào store ở root layout):
 *  - hợp lệ → render children.
 *  - hết hạn / lỗi (còn cookie) → null; popup hết phiên do AuthProvider (global) lo.
 *  - không cookie → redirect /login.
 */
export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { user, isExpired, isError } = await getCurrentUser()
  if (user) {
    return children
  }
  if (isExpired || isError) {
    return null
  }
  redirect("/login")
}
