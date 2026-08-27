import { AppHeader } from "@/components/common/app-header"

/**
 * Input: Nội dung các trang chưa gắn với một tổ chức nào.
 * Output: Khung đơn giản: header full-width (logo + đổi sáng/tối + avatar) rồi tới nội dung.
 *
 *         Đây là khung cho hai trang không có sidebar, vì cả hai đều xảy ra khi CHƯA có tổ
 *         chức để dựng sidebar: `/` lúc user chưa thuộc tổ chức nào, và `/join/<mã>` khi
 *         người ta bấm link mời (có thể chưa là thành viên).
 *
 *         `(plain)` là route group nên không xuất hiện trên URL — nó chỉ tồn tại để hai trang
 *         này nhận khung khác với `/orgs/[orgId]`.
 */
export default function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  )
}
