import type { Metadata } from "next"
import { JoinView } from "./_components/join-view"

// Trang chỉ có ý nghĩa với người cầm liên kết; không cho công cụ tìm kiếm lập chỉ mục để mã tham
// gia không rơi vào kết quả tìm kiếm.
export const metadata: Metadata = {
  title: "Lời mời tham gia",
  robots: { index: false, follow: false },
}

/**
 * Input: Mã tham gia nằm trên URL (/join/ABCD1234).
 * Output: Chỉ lấy mã ra khỏi URL rồi giao cho `JoinView` — toàn bộ việc xem trước lời mời và ba
 *         trạng thái của nó chạy ở client (xem file đó).
 *
 *         File này vẫn là server component, nhưng KHÔNG gọi BE nữa: nó chỉ còn giữ `metadata`
 *         (title + robots noindex), thứ mà client component không export được.
 */
export default async function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  return <JoinView joinCode={code} />
}
