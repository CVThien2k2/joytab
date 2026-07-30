import { RequireGuest } from "@/components/wrapper/require-guest"
import { ThemeModeButton } from "@/components/common/theme-mode-button"

/**
 * Input: Nội dung các route auth (login).
 * Output: Bọc RequireGuest — đã đăng nhập → /, ngược lại hiện form trên nền
 *         background phẳng, kèm nút đổi theme nổi ở góc trên phải.
 *         Thêm tài khoản đi thẳng OAuth (/auth/google), không qua route này.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <RequireGuest>
      <div className="relative flex min-h-screen flex-col bg-background">
        <ThemeModeButton className="absolute top-4 right-4 sm:top-6 sm:right-6" />
        {children}
      </div>
    </RequireGuest>
  )
}
