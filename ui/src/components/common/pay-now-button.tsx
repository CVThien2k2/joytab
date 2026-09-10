"use client"

import { useState } from "react"
import { PayDialog } from "@/components/common/pay-dialog"
import { Button } from "@/components/ui/button"
import { useUnpaidChargeSummary } from "@/hooks/use-payments-api"

/**
 * Input: id tổ chức + hình dáng nút (tuỳ chỗ đặt).
 * Output: Nút "Trả ngay" mở thẳng hộp thoại thanh toán. Không nợ gì thì KHÔNG render gì.
 *
 *         Mở thẳng hộp thoại chứ không dẫn sang một trang trung gian: người ta đã biết mình nợ
 *         bao nhiêu rồi (con số luôn đứng ngay cạnh nút này), việc còn lại là chuyển tiền.
 *
 *         Công nợ đọc qua `useUnpaidChargeSummary` nên mọi chỗ đặt nút này dùng CHUNG một entry
 *         cache với badge trên sidebar — ba chỗ hiển thị, một request, và không bao giờ lệch
 *         nhau một con số.
 *
 *         Không có QR thì không có chỗ chuyển tiền tới (BE cũng chặn bằng PAY_005), nên ở đó
 *         nói thẳng phải nhắc ai — thay vì để một cái nút bấm vào chỉ để nhận lỗi.
 */
export function PayNowButton({
  organizationId,
  label = "Trả ngay",
  size = "sm",
}: {
  organizationId: string
  label?: string
  size?: "sm" | "default"
}) {
  const { group, unpaidCount } = useUnpaidChargeSummary(organizationId)
  const [open, setOpen] = useState(false)

  if (!group || unpaidCount === 0) return null

  if (!group.paymentQrUrl) {
    return (
      <p className="text-xs text-muted-foreground">
        Tổ chức chưa có mã QR — nhắc chủ tổ chức cấu hình
      </p>
    )
  }

  return (
    <>
      <Button type="button" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>

      {/* Chỉ dựng khi mở: hộp thoại mang theo cả ô chọn ảnh và bản xem trước QR, mà nút này có
          mặt ở nhiều trang nên dựng sẵn là trả giá ở mọi trang cho một thao tác hiếm. */}
      {open ? <PayDialog group={group} open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
