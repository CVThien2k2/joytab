"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuthHydration } from "@/hooks/use-auth-hydration"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Nội dung các route private cần đăng nhập trong App Router.
 * Output: Chỉ render nội dung khi đã đăng nhập, ngược lại điều hướng về `/login`.
 */
export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const hasHydrated = useAuthHydration()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const session = useAuthStore((state) => state.session)

  useEffect(() => {
    if (hasHydrated && (!isAuthenticated || !session)) {
      router.replace("/login")
    }
  }, [hasHydrated, isAuthenticated, router, session])

  if (!hasHydrated || !isAuthenticated || !session) {
    return null
  }

  return children
}
