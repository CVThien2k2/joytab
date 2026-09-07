"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useMe } from "@/hooks/use-auth-api"
import { useOrganizations } from "@/hooks/use-organizations-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Nội dung khu đã đăng nhập.
 * Output: Bootstrap khu đã đăng nhập ở PHÍA CLIENT: gọi /auth/me và /organizations song song,
 *         chờ cả hai xong mới dựng cây bên dưới. Không còn lượt gọi BE nào từ Next server.
 *
 *         Gọi luôn /organizations ở đây dù store của nó dựng ở tầng dưới (layout `/orgs/[orgId]`
 *         và `/me` mỗi nơi chọn "tổ chức đang xem" một kiểu): làm vậy thì cả khu chỉ có MỘT
 *         màn chờ, và các layout dưới đọc từ cache có sẵn nên không nháy loading lần hai.
 *
 *         Điều kiện vào được app là `user` trong store đã có, KHÔNG phải query đã xong: `useMe`
 *         bơm store trong effect, tức là chậm hơn một nhịp render. Chờ theo store thì không
 *         component nào bên dưới phải chịu một nhịp `user === null`.
 *
 *         Chỉ tải dữ liệu, KHÔNG điều hướng: "chưa đăng nhập thì về /login" và "chưa onboarding
 *         thì về /onboarding" là việc của gác cổng (proxy) — nó đọc cookie nên quyết được ngay
 *         ở request đầu, không phải chờ fetch xong mới biết. Còn hạn token là việc của apiClient.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const me = useMe()
  const organizations = useOrganizations()
  const user = useAuthStore((state) => state.user)

  // Lỗi xét TRƯỚC màn chờ: hết pending mà không có data thì `user` sẽ mãi là null, xét sau thì
  // người dùng ngồi trong spinner vĩnh viễn.
  if (me.isError || organizations.isError) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="text-base font-semibold tracking-tight">Không tải được dữ liệu</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Máy chủ không trả lời. Thử lại, hoặc đăng xuất rồi đăng nhập lại.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => {
                void me.refetch()
                void organizations.refetch()
              }}
            >
              Thử lại
            </Button>
            {/* Thẻ `a` chứ không Link: đây là lối thoát khi phiên hỏng, phải nạp lại cả app. */}
            <Button asChild variant="outline">
              <a href="/logout">Đăng xuất</a>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (!user || !organizations.data) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm">Đang tải dữ liệu của bạn</p>
        </div>
      </main>
    )
  }

  return children
}
