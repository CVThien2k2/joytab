"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuthHydration } from "@/hooks/use-auth-hydration"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Nội dung các route auth chỉ dành cho người chưa đăng nhập.
 * Output: Render nội dung khi chưa đăng nhập, ngược lại điều hướng về `/`.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const hasHydrated = useAuthHydration()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const session = useAuthStore((state) => state.session)

  useEffect(() => {
    if (hasHydrated && isAuthenticated && session) {
      router.replace("/")
    }
  }, [hasHydrated, isAuthenticated, router, session])

  if (!hasHydrated || (isAuthenticated && session)) {
    return null
  }

  return children
}
