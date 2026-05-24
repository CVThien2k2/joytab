"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; đọc session đăng nhập từ Zustand store.
 * Output: Render trang chủ khi đã login, hoặc điều hướng sang `/login` nếu chưa login.
 */
export function HomePageClient() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const session = useAuthStore((state) => state.session)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    if (!isAuthenticated || !session) {
      router.replace("/login")
    }
  }, [isAuthenticated, router, session])

  if (!isAuthenticated || !session) {
    return null
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">
          Joytab Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Đăng nhập Google thành công, session đã được lưu local bằng Zustand.
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          <p>User: {session.user.email}</p>
          <p>Access token: {session.accessToken.slice(0, 18)}...</p>
          <p>Refresh token: {session.refreshToken.slice(0, 18)}...</p>
        </div>

        <Button
          type="button"
          onClick={() => {
            logout()
            router.replace("/login")
          }}
          className="mt-6 w-full"
        >
          Đăng xuất
        </Button>
      </div>
    </main>
  )
}
