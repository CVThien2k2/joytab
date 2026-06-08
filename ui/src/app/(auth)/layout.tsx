"use client"

import { AuthHeader } from "./_components/auth-header"

/**
 * Input: Nội dung các route auth.
 * Output: Khung trang auth (header + nội dung). /login hiển thị cả khi đã đăng nhập (để thêm tài khoản).
 */
export default function AuthLayout({
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
