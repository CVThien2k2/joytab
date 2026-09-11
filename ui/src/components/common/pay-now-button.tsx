"use client"

import { useState } from "react"
import { PayDialog } from "@/components/common/pay-dialog"
import { Button } from "@/components/ui/button"
import { useUnpaidChargeSummary } from "@/hooks/use-payments-api"
import type { OrganizationChargeGroup } from "@/types/payment"

/**
 * Input: id tổ chức + hình dáng nút (tuỳ chỗ đặt).
 * Output: Nút "Trả ngay" mở thẳng hộp thoại thanh toán. Không nợ gì thì không có nút nào.
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
  /**
   * Công nợ CHỤP LẠI lúc bấm mở, và số lần đã mở.
   *
   * Chụp lại vì hộp thoại phải sống lâu hơn cái nút: trả xong là `unpaidCount` về 0 và cả
   * component này lẽ ra biến mất — kéo theo hộp thoại đang mờ dần biến mất theo. Giữ bản chụp
   * thì ruột hộp thoại đứng yên cho tới lúc nó tắt hẳn.
   *
   * `openToken` vừa là điều kiện dựng (0 = chưa mở lần nào thì không dựng gì), vừa là `key`:
   * mỗi lần mở là một instance MỚI, nên ảnh và ô chọn của lần trước không còn — đúng thứ mà
   * cách cũ (unmount lúc đóng) cho không, cùng khuôn với `openToken` ở khu chốt chi phí.
   */
  const [openedGroup, setOpenedGroup] = useState<OrganizationChargeGroup | null>(null)
  const [openToken, setOpenToken] = useState(0)

  function openDialog(): void {
    if (!group) return
    setOpenedGroup(group)
    setOpenToken((token) => token + 1)
    setOpen(true)
  }

  const hasDebt = Boolean(group) && unpaidCount > 0

  return (
    <>
      {hasDebt ? (
        // Chưa có tài khoản nhận tiền thì không có chỗ chuyển tới (BE cũng chặn bằng PAY_005),
        // nên nói thẳng phải nhắc ai — thay vì để một cái nút bấm vào chỉ để nhận lỗi.
        group?.bankAccount ? (
          <Button type="button" size={size} onClick={openDialog}>
            {label}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tổ chức chưa có tài khoản nhận tiền — nhắc chủ tổ chức cấu hình
          </p>
        )
      ) : null}

      {/* KHÔNG tháo khi đóng: tháo lúc `open` về false là hộp thoại biến mất tức thì, không kịp
          chạy animation ra — cả tấm phủ cũng tắt phụp. Dựng từ lần mở ĐẦU TIÊN và giữ lại từ
          đó: nút này có mặt ở nhiều trang, nên trang nào không ai bấm thì vẫn không dựng gì. */}
      {openedGroup ? (
        <PayDialog key={openToken} group={openedGroup} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  )
}
