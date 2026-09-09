"use client"

import { useState } from "react"
import Link from "next/link"
import { Wallet } from "lucide-react"
import { PayDialog } from "@/components/common/pay-dialog"
import { Button } from "@/components/ui/button"
import { useUnpaidChargeSummary } from "@/hooks/use-payments-api"
import { formatMoney } from "@/lib/format"

/**
 * Input: id tổ chức đang xem.
 * Output: Dải nhắc "bạn còn khoản chưa trả" kèm nút trả ngay. Không nợ gì thì KHÔNG render gì.
 *
 *         Cặp với badge trên sidebar, chia việc rõ ràng: badge nói CÓ nợ và có mặt ở mọi trang,
 *         dải này nói BAO NHIÊU và cho trả ngay tại chỗ. Chỉ badge thì người ta phải bấm vào
 *         mới biết số tiền; chỉ dải này thì rời trang là quên.
 *
 *         Nút mở thẳng `PayDialog` chứ không dẫn sang trang thanh toán: người ta đã biết mình
 *         nợ bao nhiêu rồi, việc còn lại là chuyển tiền — bắt đi qua một trang trung gian chỉ
 *         để bấm đúng cái nút đó là thêm một bước không mang thông tin gì mới.
 *
 *         Vẫn giữ "Xem chi tiết" cho trường hợp ngược lại: muốn biết nợ từ những buổi nào
 *         trước khi trả.
 *
 *         Không có QR thì không có chỗ chuyển tiền tới — BE cũng chặn (PAY_005), nên ở đây nói
 *         thẳng phải nhắc ai, thay vì để một cái nút bấm vào chỉ để nhận lỗi.
 *
 *         Đặt ở trang LỊCH THI ĐẤU vì đó là trang ai cũng vào: `/orgs/[orgId]` là màn cấu hình
 *         chỉ owner mở được, còn trang thanh toán thì đã là nơi cần tới rồi — nhắc ở đó là nói
 *         với người đang đứng sẵn trước mặt mình.
 */
export function UnpaidChargesBanner({ organizationId }: { organizationId: string }) {
  const { group, unpaidCount, unpaidTotal } = useUnpaidChargeSummary(organizationId)
  const [payOpen, setPayOpen] = useState(false)

  if (!group || unpaidCount === 0) return null

  return (
    <section className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
      <Wallet className="size-5 shrink-0 text-primary" aria-hidden="true" />

      <p className="min-w-0 flex-1 text-sm font-medium">
        Bạn còn {unpaidCount} khoản chưa trả ·{" "}
        <span className="font-bold tabular-nums">{formatMoney(unpaidTotal)}đ</span>
      </p>

      <Button asChild variant="ghost" size="sm">
        <Link href={`/orgs/${organizationId}/payments`}>Xem chi tiết</Link>
      </Button>

      {group.paymentQrUrl ? (
        <Button type="button" size="sm" onClick={() => setPayOpen(true)}>
          Trả ngay
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tổ chức chưa có mã QR — nhắc chủ tổ chức cấu hình
        </p>
      )}

      {payOpen ? <PayDialog group={group} open={payOpen} onOpenChange={setPayOpen} /> : null}
    </section>
  )
}
