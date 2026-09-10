"use client"

import { UnpaidChargesBanner } from "@/components/common/unpaid-charges-banner"
import { useActiveOrganization } from "@/stores/organization-store"
import { MatchHistoryList } from "./_components/match-history-list"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang Lịch sử đấu: những buổi CỦA CHÍNH MÌNH đã chốt tiền hoặc đã huỷ, kèm dải nhắc
 *         nợ ở trên cùng.
 *
 *         BE chỉ trả buổi mình có mặt (đã đăng ký, hoặc đã bị chia tiền) — đây là sổ riêng chứ
 *         không phải sổ của cả tổ chức. Nhờ vậy nó trả lời được câu duy nhất người ta mở trang
 *         này để hỏi: "mình đã đá những buổi nào, còn nợ buổi nào".
 *
 *         Là một trang RIÊNG chứ không phải một khối ở trang chủ: trang chủ nói về những gì
 *         SẮP tới và phải vừa một màn hình, còn đây là danh sách cuộn dài không giới hạn.
 *
 *         Trả tiền được ngay tại đây: dải nhắc ở trên mở thẳng hộp thoại thanh toán, còn danh
 *         sách ngay dưới nói rõ số tiền đó đến từ những buổi nào.
 */
export default function OrganizationMatchHistoryPage() {
  const organization = useActiveOrganization()

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:px-6">
      {/* Không lặp lại tên trang ở đây: breadcrumb trên thanh header đã nói, mà nói hai lần thì
          lần thứ hai chỉ tốn chiều cao. */}
      <UnpaidChargesBanner organizationId={organization.id} />

      <MatchHistoryList organizationId={organization.id} />
    </main>
  )
}
