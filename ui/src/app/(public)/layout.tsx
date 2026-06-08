import { AuthHeader } from "./_components/auth-header"

/**
 * Input: Nội dung các route public (không cần đăng nhập).
 * Output: Khung trang public (header + nội dung). Không gate auth; /login hiển thị cả khi đã đăng nhập (để thêm tài khoản).
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthHeader />
      {children}
    </div>
  )
}
