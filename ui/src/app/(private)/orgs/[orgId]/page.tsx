"use client"

import { Separator } from "@/components/ui/separator"
import { useActiveOrganization } from "@/stores/organization-store"
import { HomeGreeting } from "./_components/home-greeting"
import { OrganizationStats } from "./_components/organization-stats"
import { UpcomingMatches } from "./_components/upcoming-matches"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang chủ của một tổ chức, hai khối tách bạch:
 *
 *          1. Lời chào + ngày hôm nay, rồi bốn con số tổng quan.
 *          2. Danh sách buổi sắp diễn ra, đăng ký được ngay trên hàng.
 *
 *         MỌI thành viên vào được. Trước đây đường dẫn này là màn cấu hình chỉ owner mở được,
 *         còn ai cũng vào lịch thi đấu — nhưng gốc của một tổ chức phải là thứ mọi người mở
 *         hàng ngày, không phải thứ vài tháng sửa một lần. Cấu hình dời sang `/settings`.
 *
 *         Một đường kẻ giữa hai khối chứ không chỉ là khoảng trắng: chúng là hai loại nội dung
 *         khác hẳn nhau — trên là những con số ĐỌC, dưới là danh sách LÀM (đăng ký, tạo lịch,
 *         mở chi tiết) — mà chỉ giãn khoảng cách thì mắt vẫn đọc cả trang thành một mạch.
 *
 *         KHÔNG có nút trả tiền ở đây: ô "Cần thanh toán" dẫn thẳng sang Trận của tôi, nơi vừa
 *         thấy số tiền đó đến từ những buổi nào vừa trả được. Trang chủ nói tình hình, trang
 *         kia giải quyết.
 *
 *         Mở đầu bằng lời chào chứ không phải tên tổ chức: breadcrumb trên thanh header đã nói
 *         đang ở tổ chức nào, mà nói hai lần thì lần thứ hai chỉ tốn chiều cao.
 */
export default function OrganizationHomePage() {
  const organization = useActiveOrganization()

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="space-y-4">
        <HomeGreeting />
        <OrganizationStats organizationId={organization.id} />
      </div>

      <Separator className="my-6" />

      <UpcomingMatches organizationId={organization.id} isOwner={organization.role === "owner"} />
    </main>
  )
}
