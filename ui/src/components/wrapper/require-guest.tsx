"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: children (nội dung chỉ dành cho khách CHƯA đăng nhập, vd /login).
 * Output: Guard đọc `user` từ store:
 *  - đã đăng nhập (có user) → redirect /.
 *  - chưa đăng nhập → render children (form).
 *
 * Không cần lo trạng thái "chưa biết": AppWrapper đã chặn render tới khi store rehydrate xong.
 */
export function RequireGuest({ children }: { children: ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (user) {
      router.replace("/")
    }
  }, [user, router])

  if (user) {
    return null
  }
  return <>{children}</>
}
