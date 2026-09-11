"use client"

import { Separator } from "@/components/ui/separator"
import { useActiveOrganization } from "@/stores/organization-store"
import { HomeGreeting } from "./_components/home-greeting"
import { OrganizationStats } from "./_components/organization-stats"
import { OrganizationSummaryCard } from "./_components/organization-summary-card"
import { UpcomingMatches } from "./_components/upcoming-matches"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang chủ của một tổ chức, ba khối tách bạch:
 *
 *          1. Hồ sơ tổ chức gói trong MỘT thẻ hai hàng, ngay đầu trang.
 *          2. Lời chào + ngày hôm nay, rồi bốn con số tổng quan.
 *          3. Danh sách buổi sắp diễn ra, đăng ký được ngay trên hàng.
 *
 *         MỌI thành viên vào được, kể cả khối thứ nhất. Trước đây nó là một trang riêng
 *         `/settings` chỉ owner mở được — nhưng phần lớn nội dung của nó ("nhóm gồm những ai",
 *         "mã mời là gì", "tiền chuyển đi đâu", "nam đóng gấp mấy") là thứ mọi thành viên cần
 *         đọc, và giấu sau một trang chỉ owner vào được thì member phải đi hỏi. Thao tác thật
 *         sự của owner nằm trong menu "..." của chính thẻ đó.
 *
 *         Hồ sơ ĐỨNG ĐẦU dù là thứ tra thi thoảng: gộp lại còn đúng hai hàng nên nó không đẩy
 *         lịch và tiền xuống nữa, mà đặt đầu thì nó trả lời ngay câu "mình đang ở tổ chức nào"
 *         trước khi mắt đọc tới bất cứ con số nào của tổ chức đó.
 *
 *         Đường kẻ giữa các khối chứ không chỉ là khoảng trắng: chúng là ba loại nội dung khác
 *         hẳn nhau — hồ sơ để TRA, số để ĐỌC, danh sách để LÀM — mà chỉ giãn khoảng cách thì
 *         mắt vẫn đọc cả trang thành một mạch.
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
      <OrganizationSummaryCard organization={organization} />

      <Separator className="my-6" />

      <div className="space-y-4">
        <HomeGreeting />
        <OrganizationStats organizationId={organization.id} />
      </div>

      <Separator className="my-6" />

      <UpcomingMatches organizationId={organization.id} isOwner={organization.role === "owner"} />
    </main>
  )
}
