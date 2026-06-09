"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSwitchAccount } from "@/hooks/use-auth-api"
import type { DeviceAccount } from "@/types/auth"

/**
 * Input: Danh sách account trên thiết bị (lấy theo device_id ở server).
 * Output: Cho chọn account còn sống để switch (BE set session_id mới → reload về /),
 *         account cần đăng nhập lại / không có account → link sang /login.
 */
export function SwitchAccountActions({ accounts }: { accounts: DeviceAccount[] }) {
  const switchAccount = useSwitchAccount()

  const handleSwitch = (userId: string) => {
    switchAccount.mutate(userId, {
      onSuccess: () => {
        // session_id mới đã được set → reload để useMe chạy lại theo session mới.
        window.location.href = "/"
      },
    })
  }

  return (
    <div className="space-y-3">
      {accounts.length > 0 ? (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.userId}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {account.fullName ?? account.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">{account.email}</p>
              </div>
              {account.needsRelogin ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/login">Đăng nhập lại</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={switchAccount.isPending}
                  onClick={() => handleSwitch(account.userId)}
                >
                  Tiếp tục
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        asChild
        variant={accounts.length > 0 ? "outline" : "default"}
        className="w-full"
      >
        <Link href="/login">Đăng nhập tài khoản khác</Link>
      </Button>
    </div>
  )
}
