"use client"

import { useActiveOrganization } from "@/stores/organization-store"
import { MatchHistoryList } from "./_components/match-history-list"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang Trận của tôi: những buổi đã qua CỦA CHÍNH MÌNH kèm số tiền của mình ở từng
 *         buổi.
 *
 *         BE chỉ trả buổi mình có mặt (đã đăng ký, hoặc đã bị chia tiền) — đây là sổ riêng chứ
 *         không phải sổ của cả tổ chức. Nhờ vậy nó trả lời được câu duy nhất người ta mở trang
 *         này để hỏi: "mình đã đá những buổi nào, còn nợ buổi nào".
 *
 *         Là một SỔ NỢ, không phải chỗ tra cứu: mỗi dòng chỉ còn giờ, sân và số tiền đã trả
 *         hay chưa — không avatar, không sĩ số, và bấm vào cũng không mở gì. Buổi đã đá xong
 *         thì không còn việc nào để làm với nó ngoài trả tiền.
 *
 *         Là một trang RIÊNG chứ không phải một khối ở trang chủ: trang chủ nói về những gì
 *         SẮP tới và phải vừa một màn hình, còn đây là danh sách cuộn dài không giới hạn.
 *
 *         Không còn dải nhắc nợ riêng ở đầu trang: thanh nhắc nợ giờ dính đáy màn hình ở MỌI
 *         trang (`OrgNoticeBars`), nên để thêm một bản ở đây là hỏi cùng một câu hai lần trong
 *         cùng một khung hình. Danh sách bên dưới vẫn là chỗ trả lời "số tiền đó đến từ buổi
 *         nào".
 */
export default function OrganizationMatchHistoryPage() {
  const organization = useActiveOrganization()

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:px-6">
      {/* Không lặp lại tên trang ở đây: breadcrumb trên thanh header đã nói, mà nói hai lần thì
          lần thứ hai chỉ tốn chiều cao. */}
      <MatchHistoryList organizationId={organization.id} />
    </main>
  )
}
