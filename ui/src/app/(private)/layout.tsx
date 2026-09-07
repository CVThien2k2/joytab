import { SessionGate } from "@/providers/session-gate"

/**
 * Input: Nội dung các route đã đăng nhập.
 * Output: Vỏ khu đã đăng nhập. KHÔNG gọi BE ở server: gác cổng nhanh bằng cookie nằm ở `proxy`,
 *         còn dữ liệu phiên (user + danh sách tổ chức) do `SessionGate` tải ở client.
 *
 *         KHÔNG có header ở đây: khu vực đã đăng nhập có hai kiểu khung khác nhau — nhóm
 *         `(plain)` (chưa vào tổ chức nào, hoặc đang xem lời mời) dùng header full-width, còn
 *         `/orgs/[orgId]` dùng khung có sidebar. Đặt header ở đây thì nhóm sau sẽ có hai
 *         header lồng nhau.
 */
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate>{children}</SessionGate>
}
