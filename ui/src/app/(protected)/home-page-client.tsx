"use client"

import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; đọc user từ Zustand store.
 * Output: Render nội dung dashboard sau khi user đã được middleware xác thực qua cookie.
 */
export function HomePageClient() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Joytab Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Đăng nhập Google thành công. Phiên đăng nhập được bảo vệ bằng cookie httpOnly.
      </p>

      <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <p>User: {user?.email ?? "—"}</p>
        <p>Provider: {user?.provider ?? "—"}</p>
        <p>Full name: {user?.fullName ?? "—"}</p>
      </div>
    </div>
  )
}
