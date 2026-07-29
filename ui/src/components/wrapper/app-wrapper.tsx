"use client"

import { useEffect, type ReactNode } from "react"
import { LoadingScreen } from "@/components/common/loading-screen"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: children — bọc TOÀN app (trong QueryProvider).
 * Output: Rehydrate store từ localStorage rồi mới render.
 *
 * Store dùng `skipHydration` nên phải gọi rehydrate() ở đây: làm trong useEffect để render
 * đầu tiên của client giống hệt server (đều chưa có user), tránh hydration mismatch. Trong
 * lúc chờ thì hiện LoadingScreen — chỉ dài đúng một tick, không phải chờ network.
 *
 * KHÔNG gọi /auth/me ở đây: user đã được trang /auth/callback lưu vào localStorage lúc login.
 */
export function AppWrapper({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((state) => state.hydrated)

  useEffect(() => {
    void useAuthStore.persist.rehydrate()
  }, [])

  if (!hydrated) return <LoadingScreen />

  return children
}
