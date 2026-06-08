"use client"

import { Button } from "@/components/ui/button"
import { useAccounts, useLogout, useMe, useSwitchAccount } from "@/hooks/use-auth-api"
import { redirectToGoogleLogin } from "@/lib/google-login"

/**
 * Input: Không nhận tham số; đọc trạng thái auth trực tiếp từ BE qua cookie session.
 * Output: Hiển thị account đang dùng (/auth/me) + danh sách account trên thiết bị (/auth/accounts),
 *         cho switch / thêm tài khoản / đăng nhập lại / đăng xuất.
 */
export function HomePageClient() {
  const meQuery = useMe()
  const accountsQuery = useAccounts()
  const switchAccount = useSwitchAccount()
  const logout = useLogout()

  const activeUserId = meQuery.data?.userId
  const accounts = accountsQuery.data ?? []

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">Chuyển tài khoản</h2>
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
            {meQuery.isPending ? (
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
            {accounts.map((account) => {
              const isActive = account.userId === activeUserId
              return (
                <li
                  key={account.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700"
                >
                  <span>
                    {account.email}
                    {isActive ? " (đang dùng)" : ""}
                    {account.needsRelogin ? (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Cần đăng nhập lại
                      </span>
                    ) : null}
                  </span>
                  {account.needsRelogin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => redirectToGoogleLogin({ selectAccount: true })}
                    >
                      Đăng nhập lại
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isActive || switchAccount.isPending}
                      onClick={() => switchAccount.mutate(account.userId)}
                    >
                      Dùng
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="mt-4"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Đăng xuất
          </Button>
        </section>
      </div>
    </main>
  )
}
