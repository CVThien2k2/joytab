"use client"

import { Wallet } from "lucide-react"
import { PayNowButton } from "@/components/common/pay-now-button"
import { useUnpaidChargeSummary } from "@/hooks/use-payments-api"
import { formatMoney } from "@/lib/format"

/**
 * Input: id tổ chức đang xem.
 * Output: Dải nhắc "bạn còn khoản chưa trả" kèm nút trả ngay. Không nợ gì thì KHÔNG render gì.
 *
 *         Cặp với badge trên sidebar, chia việc rõ ràng: badge nói CÓ nợ và có mặt ở mọi trang,
 *         dải này nói BAO NHIÊU và cho trả ngay tại chỗ.
 *
 *         Có mặt ở hai trang, mỗi nơi một vai: ở TRANG CHỦ nó là việc-phải-làm đứng ngay dưới
 *         lời chào (bốn thẻ thống kê chỉ nói "bao nhiêu", không bấm được); ở LỊCH SỬ ĐẤU nó có
 *         thêm ngữ cảnh — danh sách ngay dưới là những buổi mình đã đá, mỗi buổi mang nhãn đã
 *         trả / chưa trả, tức là chỗ nhìn ra số tiền đó đến từ đâu.
 *
 *         Không tự chừa khoảng cách (`mb-*`): trang đặt nó mới biết nó đứng cạnh cái gì.
 */
export function UnpaidChargesBanner({ organizationId }: { organizationId: string }) {
  const { unpaidCount, unpaidTotal } = useUnpaidChargeSummary(organizationId)

  if (unpaidCount === 0) return null

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
      <Wallet className="size-5 shrink-0 text-primary" aria-hidden="true" />

      <p className="min-w-0 flex-1 text-sm font-medium">
        Bạn còn {unpaidCount} khoản chưa trả ·{" "}
        <span className="font-bold tabular-nums">{formatMoney(unpaidTotal)}đ</span>
      </p>

      <PayNowButton organizationId={organizationId} />
    </section>
  )
}
