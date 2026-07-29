"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { fetchMe } from "@/api/auth"
import { LoadingScreen } from "@/components/common/loading-screen"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số. BE redirect tới đây sau khi OAuth thành công và đã set cookie
 *        `at` + `rt`.
 * Output: Gọi /auth/me đúng MỘT lần để lấy user, lưu vào store (persist localStorage), rồi
 *         về `/`. Thất bại → về /login.
 *
 * Đây là chỗ duy nhất trong app gọi /auth/me: OAuth là redirect 302 nên không có response
 * body nào để trả user về, còn các lần load sau thì store đã có sẵn trong localStorage.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  // StrictMode ở dev chạy effect hai lần — chốt lại để không gọi /auth/me hai lần.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void fetchMe()
      .then((user) => {
        setUser(user)
        router.replace("/")
      })
      .catch(() => {
        router.replace("/login")
      })
  }, [router, setUser])

  return <LoadingScreen />
}
