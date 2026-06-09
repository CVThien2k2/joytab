import { RequireGuest } from "@/components/wrapper/require-guest"
import { AuthHeader } from "./_components/auth-header"

/**
 * Input: Nội dung các route auth (login).
 * Output: Bọc RequireGuest — đã đăng nhập → /, ngược lại hiện form.
 *         Thêm tài khoản đi thẳng OAuth (/auth/google), không qua route này.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <RequireGuest>
      <div className="flex min-h-screen flex-col bg-background">
        <AuthHeader />
        {children}
      </div>
    </RequireGuest>
  )
}
