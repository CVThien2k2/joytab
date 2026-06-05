"use client"

import { usePathname } from "next/navigation"
import { useAuthHydration } from "@/hooks/use-auth-hydration"
import { AuthHeader } from "./_components/auth-header"

/**
 * Input: Nội dung các route auth.
 * Output: Render nội dung sau khi store đã hydrate.
 *         /login giờ là màn chọn tài khoản nên hiển thị cả khi đã đăng nhập (KHÔNG đá về "/").
 *         Route callback luôn render để xử lý exchange.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const hasHydrated = useAuthHydration()
  const isCallbackRoute = pathname?.startsWith("/login/callback") ?? false

  if (isCallbackRoute) return children
  if (!hasHydrated) return null
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthHeader />
      {children}
    </div>
  )
}
