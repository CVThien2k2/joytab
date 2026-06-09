"use client"

import Link from "next/link"
import { useMe } from "@/hooks/use-auth-api"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/auth/logout-button"

/**
 * Input: Không nhận props; lấy user qua useMe (react-query, CSR).
 * Output: Hiển thị tài khoản đang dùng + nút đăng xuất + link demo gọi API 401.
 */
export function CurrentUserCard() {
  const { data: user, isPending } = useMe()

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">Tài khoản đang dùng</h2>
            <LogoutButton />
          </div>

          {isPending ? (
            <p className="mt-4 text-sm text-zinc-500">Đang tải…</p>
          ) : user ? (
            <div className="mt-4 space-y-1 text-sm text-zinc-800">
              <p className="font-medium">{user.user.fullName ?? user.user.email}</p>
              <p className="text-zinc-600">{user.user.email}</p>
              <p className="text-xs text-zinc-500">ID: {user.userId}</p>
            </div>
          ) : null}
        </section>

        <Button asChild>
          <Link href="/users">Xem users (demo gọi API 401) →</Link>
        </Button>
      </div>
    </main>
  )
}
