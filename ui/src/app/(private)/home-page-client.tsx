"use client"

import { Button } from "@/components/ui/button"
import { useMemo } from "react"
import {
  useLogout,
  useMe,
} from "@/hooks/use-auth-api"
import { useRestoreAccounts } from "@/hooks/use-restore-accounts"
import { redirectToGoogleLogin } from "@/lib/google-login"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; đọc danh sách account từ Zustand store.
 * Output: Render một component chuyển account và thông tin user hiện tại lấy từ BE.
 */
export function HomePageClient() {
  useRestoreAccounts()

  const accounts = useAuthStore((s) => s.accounts)
  const accountList = useMemo(() => Object.values(accounts), [accounts])
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount)

  const meQuery = useMe()
  const logout = useLogout()

  if (accountList.length === 0) {
    return null
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Chuyển tài khoản
            </h2>
            <Button
              type="button"
              size="sm"
              onClick={() => redirectToGoogleLogin({ selectAccount: true })}
            >
              Thêm tài khoản
            </Button>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-medium text-zinc-500">Đang sử dụng</p>
            {meQuery.isLoading ? (
              <p className="mt-2 text-sm text-zinc-600">Đang tải thông tin...</p>
            ) : meQuery.isError ? (
              <p className="mt-2 text-sm text-red-600">Không tải được thông tin tài khoản.</p>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p className="font-medium">{meQuery.data?.user.fullName ?? meQuery.data?.user.email}</p>
                <p className="text-zinc-600">{meQuery.data?.user.email}</p>
                <p className="text-xs text-zinc-500">ID: {meQuery.data?.userId}</p>
              </div>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {accountList.map((account) => {
              const isActive = account.userId === activeAccountId
              return (
                <li
                  key={account.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700"
                >
                  <span>
                    {account.user.email}
                    {isActive ? " (đang dùng)" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isActive}
                      onClick={() => setActiveAccount(account.userId)}
                    >
                      Dùng
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={logout.isPending}
                      onClick={() => logout.mutate(account.userId)}
                    >
                      Đăng xuất
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </main>
  )
}
