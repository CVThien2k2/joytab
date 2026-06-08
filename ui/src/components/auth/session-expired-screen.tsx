"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LogoutButton } from "@/components/auth/logout-button"

/**
 * Input: Không nhận props.
 * Output: Full-page "hết phiên đăng nhập" + nút đăng xuất. AuthProvider render thay nội dung khi isExpired.
 */
export function SessionExpiredScreen() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center pb-2 text-center">
          <CardTitle className="mt-2">Hết phiên đăng nhập</CardTitle>
          <CardDescription>
            Phiên của bạn đã hết hạn hoặc bị thu hồi. Vui lòng đăng xuất để đăng nhập lại.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-2">
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  )
}
