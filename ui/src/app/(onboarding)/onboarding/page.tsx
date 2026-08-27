import type { Metadata } from "next"
import { fetchCurrentUser } from "@/api/auth.server"
import { AuthCard } from "@/components/common/auth-card"
import { isSafeInternalPath } from "@/lib/redirect"
import { AuthStoreProvider } from "@/providers/auth-store-provider"
import { OnboardingForm } from "../_components/onboarding-form"
import { OnboardingIdentity } from "../_components/onboarding-identity"

const PAGE_DESCRIPTION = "Xác nhận họ tên, tuổi, giới tính và số điện thoại để bắt đầu dùng Joytab."

// Trang chỉ user đã đăng nhập thấy được nên không cần OG/twitter card; robots noindex để
// công cụ tìm kiếm không lập chỉ mục một trang mà khách vào chỉ thấy redirect.
export const metadata: Metadata = {
  title: "Hoàn tất thông tin",
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: false },
}

/**
 * Input: Không nhận tham số.
 * Output: Màn hình onboarding. Không tự guard: proxy đã lo cả hai chiều — chưa đăng nhập thì
 *         về /login, đã onboarding rồi thì về `/`, nên vào được đây là đúng người đúng lúc.
 *
 *         Gọi /auth/me ở đây chứ không tin cookie: proxy chỉ biết "chưa onboarding", còn
 *         tên/tuổi/SĐT đã khai dở (user quay lại sửa) thì phải đọc từ BE. Fetch nằm trong
 *         page (không phải layout) để `loading.tsx` bọc được — xem comment ở layout.
 *
 *         Dùng chung AuthCard với /login, chỉ rộng hơn (max-w-md) cho vừa 4 field.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // `next` do proxy (hoặc BE sau khi login) gắn vào: khai xong đi thẳng tới đó thay vì `/`.
  const { next } = await searchParams
  const nextPath = isSafeInternalPath(next) ? next : null

  // Không destructure: narrowing của union chỉ chạy khi kiểm tra trực tiếp trên property.
  const result = await fetchCurrentUser()

  if (!result.user) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  return (
    <AuthStoreProvider initialState={{ user: result.user }}>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
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
    </AuthStoreProvider>
  )
}
