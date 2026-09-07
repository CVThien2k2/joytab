import type { Metadata } from "next"
import { isSafeInternalPath } from "@/lib/redirect"
import { OnboardingView } from "../_components/onboarding-view"

const PAGE_DESCRIPTION = "Xác nhận họ tên, tuổi, giới tính và số điện thoại để bắt đầu dùng Joytab."

// Trang chỉ user đã đăng nhập thấy được nên không cần OG/twitter card; robots noindex để
// công cụ tìm kiếm không lập chỉ mục một trang mà khách vào chỉ thấy redirect.
export const metadata: Metadata = {
  title: "Hoàn tất thông tin",
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: false },
}

/**
 * Input: `?next=<path>` do proxy (hoặc BE sau khi login) gắn vào.
 * Output: Chỉ lọc `next` rồi giao cho `OnboardingView` — form và lượt gọi /auth/me chạy ở
 *         client (xem file đó).
 *
 *         File này vẫn là server component nhưng KHÔNG gọi BE nữa: nó chỉ giữ `metadata`, thứ
 *         client component không export được.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return <OnboardingView nextPath={isSafeInternalPath(next) ? next : null} />
}
