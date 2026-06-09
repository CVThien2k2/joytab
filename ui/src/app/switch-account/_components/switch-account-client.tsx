"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAccounts } from "@/hooks/use-auth-api"
import { ExpiredNotice } from "./expired-notice"
import { SwitchAccountActions } from "./switch-account-actions"

/**
 * Input: reason (từ ?reason). Lấy danh sách account theo device_id qua useAccounts (CSR).
 * Output: Trang chọn/đổi tài khoản khi hết phiên — đích chung của cả gate private lẫn interceptor.
 *         ExpiredNotice lo dọn cookie + toast + bỏ ?reason khi vào.
 */
export function SwitchAccountClient({ reason }: { reason?: string }) {
  const { data: accounts = [] } = useAccounts()

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <ExpiredNotice reason={reason} />
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="mt-2">Chọn tài khoản</CardTitle>
          <CardDescription>
            Chọn tài khoản để tiếp tục hoặc đăng nhập lại.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <SwitchAccountActions accounts={accounts} />
        </CardContent>
      </Card>
    </main>
  )
}
