"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useEnforceActiveAccountStatus } from "@/hooks/use-auth-api"
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
  const hasAccounts = useAuthStore((s) => Object.keys(s.accounts).length > 0)
  // Vào website: check session active còn sống không (revoke từ xa) và đá account chết ra.
  useEnforceActiveAccountStatus()

  useEffect(() => {
    if (hasHydrated && !hasAccounts) router.replace("/login")
  }, [hasHydrated, hasAccounts, router])

  if (!hasHydrated || !hasAccounts) return null
  return children
}
