"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
 * Output: Full-page lỗi tải phiên (mạng / 5xx) — nút "Thử lại" (refresh) + "Đăng xuất".
 *         AuthProvider render thay nội dung khi isError.
 */
export function SessionErrorScreen() {
  const router = useRouter()
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center pb-2 text-center">
          <CardTitle className="mt-2">Không tải được phiên đăng nhập</CardTitle>
          <CardDescription>
            Đã có lỗi khi kết nối máy chủ. Vui lòng thử lại hoặc đăng xuất.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2 pt-2">
          <LogoutButton />
          <Button type="button" size="sm" onClick={() => router.refresh()}>
            Thử lại
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
