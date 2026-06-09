"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"
import { LoadingScreen } from "@/components/common/loading-screen"

/**
 * Input: children (nội dung chỉ dành cho khách CHƯA đăng nhập, vd /login).
 * Output: Guard đọc store:
 *  - chưa validate xong (!checked) → LoadingScreen (tránh nháy form rồi redirect).
 *  - đã đăng nhập (có user) → redirect /.
 *  - chưa đăng nhập → render children (form).
 */
export function RequireGuest({ children }: { children: ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const checked = useAuthStore((state) => state.checked)

  useEffect(() => {
    if (user) {
      router.replace("/")
    }
  }, [user, router])

  if (!checked) {
    return <LoadingScreen />
  }
  if (user) {
    return null
  }
  return <>{children}</>
}
