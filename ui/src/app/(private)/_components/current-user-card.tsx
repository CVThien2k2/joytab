"use client"

import { useAuthStore } from "@/stores/auth-store"
import { LogoutButton } from "@/components/common/logout-button"

/**
 * Input: Không nhận props; đọc user từ store (RequireAuth đã đảm bảo có user).
 * Output: Hiển thị tài khoản đang dùng + nút đăng xuất.
 *
 * Không cần trạng thái loading: RequireAuth chỉ render component này khi đã có user.
 */
export function CurrentUserCard() {
  const user = useAuthStore((state) => state.user)

  if (!user) return null

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">Tài khoản đang dùng</h2>
            <LogoutButton />
          </div>

          <div className="mt-4 space-y-1 text-sm text-zinc-800">
            <p className="font-medium">{user.user.fullName ?? user.user.email}</p>
            <p className="text-zinc-600">{user.user.email}</p>
            <p className="text-xs text-zinc-500">ID: {user.userId}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
