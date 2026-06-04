"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuthHydration } from "@/hooks/use-auth-hydration"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Nội dung các route auth chỉ dành cho người chưa đăng nhập.
 * Output: Render nội dung khi chưa đăng nhập, ngược lại điều hướng về `/`.
 *         Riêng route callback luôn render để xử lý exchange (kể cả khi thêm tài khoản lúc đang đăng nhập).
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const hasHydrated = useAuthHydration()
  const hasAccounts = useAuthStore((s) => Object.keys(s.accounts).length > 0)
  const isCallbackRoute = pathname?.startsWith("/login/callback") ?? false

  useEffect(() => {
    if (!isCallbackRoute && hasHydrated && hasAccounts) {
      router.replace("/")
    }
  }, [isCallbackRoute, hasHydrated, hasAccounts, router])

  if (isCallbackRoute) return children
  if (!hasHydrated || hasAccounts) return null
  return children
}
