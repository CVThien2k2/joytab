"use client"

import { AuthCard } from "@/components/common/auth-card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useMe } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/stores/auth-store"
import { OnboardingForm } from "./onboarding-form"
import { OnboardingIdentity } from "./onboarding-identity"

/**
 * Input: `nextPath` — đích user đang muốn tới trước khi bị chặn lại (đã qua isSafeInternalPath).
 * Output: Màn hình onboarding. Không tự guard: proxy đã lo cả hai chiều — chưa đăng nhập thì
 *         về /login, đã onboarding rồi thì về `/`, nên vào được đây là đúng người đúng lúc.
 *
 *         Gọi /auth/me ở CLIENT chứ không tin cookie: proxy chỉ biết "chưa onboarding", còn
 *         tên/tuổi/SĐT đã khai dở (user quay lại sửa) thì phải đọc từ BE.
 *
 *         Tự gọi `useMe` chứ không nhờ SessionGate: /onboarding nằm NGOÀI `(private)` vì lúc này
 *         user chưa được vào app. Store thì vẫn là store toàn cục — `useMe` tự bơm vào, nên
 *         OnboardingIdentity và OnboardingForm đọc `useAuthStore` như mọi chỗ khác.
 */
export function OnboardingView({ nextPath }: { nextPath: string | null }) {
  const { isError, refetch } = useMe()
  const user = useAuthStore((state) => state.user)

  if (!isError && !user) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm">Đang kiểm tra thông tin của bạn</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="text-base font-semibold tracking-tight">Không tải được thông tin</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Máy chủ không trả lời. Thử lại, hoặc đăng xuất rồi đăng nhập lại.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => void refetch()}>Thử lại</Button>
            {/* Thẻ `a` chứ không Link: lối thoát khi phiên hỏng, phải nạp lại cả app. */}
            <Button asChild variant="outline">
              <a href="/logout">Đăng xuất</a>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      {/* Dùng chung AuthCard với /login, chỉ rộng hơn (max-w-md) cho vừa 4 field. */}
      <AuthCard
        eyebrow="Bước cuối trước khi vào app"
        brand="Hoàn tất thông tin"
        className="max-w-md"
      >
        <h1 className="text-xl font-bold tracking-tight">Xác nhận thông tin của bạn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Joytab cần đủ 4 thông tin dưới đây để tạo sổ thu chi và ghi nhận bạn trong quỹ nhóm.
        </p>

        <OnboardingIdentity />

        <div className="mt-6 border-t pt-6">
          <OnboardingForm nextPath={nextPath} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Thông tin này chỉ dùng trong Joytab và bạn sửa lại được sau.
        </p>
      </AuthCard>
    </main>
  )
}
