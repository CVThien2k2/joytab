"use client"

import { useAuthStore } from "@/stores/auth-store"
import { LogoutButton } from "./logout-button"

/**
 * Input: Không nhận props; đọc user từ store (đã hydrate từ server qua AuthProvider).
 * Output: Hiển thị tài khoản đang dùng + nút đăng xuất.
 */
export function CurrentUserCard() {
  const user = useAuthStore((state) => state.user)

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">Tài khoản đang dùng</h2>
            <LogoutButton />
          </div>

          {user ? (
            <div className="mt-4 space-y-1 text-sm text-zinc-800">
              <p className="font-medium">{user.user.fullName ?? user.user.email}</p>
              <p className="text-zinc-600">{user.user.email}</p>
              <p className="text-xs text-zinc-500">ID: {user.userId}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
