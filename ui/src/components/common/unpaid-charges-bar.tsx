"use client"

import { useMemo, useState } from "react"
import { Wallet } from "lucide-react"
import { NoticeBar } from "@/components/common/notice-bar"
import { PayDialog } from "@/components/common/pay-dialog"
import { UnpaidChargesPanel } from "@/components/common/unpaid-charges-panel"
import { useUnpaidChargeSummary } from "@/hooks/use-payments-api"
import { formatMoney } from "@/lib/format"
import type { OrganizationChargeGroup } from "@/types/payment"

/**
 * Input: id tổ chức đang xem.
 * Output: Thanh nhắc "bạn còn khoản chưa trả" kèm số tiền; bấm vào là nó bị đẩy lên và danh
 *         sách từng khoản nở ra bên dưới, trả tiền bằng nút trong đó. Không nợ gì thì KHÔNG
 *         render gì.
 *
 *         Hai nhịp chứ không một: XEM đã (khoản nào, buổi nào), rồi mới TRẢ. Bấm một cái ra
 *         thẳng hộp thoại có QR là bắt người ta tin một con số tổng chưa kịp soi — mà đây là
 *         tiền thật, soi xong mới chuyển là phản xạ đúng.
 *
 *         Cặp với badge trên sidebar, chia việc rõ ràng: badge nói CÓ nợ, thanh này nói BAO
 *         NHIÊU và từ đâu. Cả hai đọc qua `useUnpaidChargeSummary` nên dùng chung một entry
 *         cache — hai chỗ hiển thị, một request, không bao giờ lệch nhau một con số.
 *
 *         Thay cho dải nhắc cũ vốn chỉ nằm ở trang "Trận của tôi": nợ là việc đi theo người,
 *         không phải thuộc tính của một trang, mà trang đó lại đúng là trang người đang nợ ít
 *         ghé nhất.
 */
export function UnpaidChargesBar({
  organizationId,
  expanded,
  onToggle,
}: {
  organizationId: string
  expanded: boolean
  onToggle: () => void
}) {
  const { group, unpaidCount, unpaidTotal } = useUnpaidChargeSummary(organizationId)

  /**
   * Công nợ CHỤP LẠI lúc bấm trả, và số lần đã mở.
   *
   * Chụp lại vì hộp thoại phải sống lâu hơn thanh nhắc: trả xong là `unpaidCount` về 0 và thanh
   * biến mất, kéo theo hộp thoại đang mờ dần biến mất giữa chừng. `openToken` vừa là điều kiện
   * dựng (0 = chưa mở lần nào thì không dựng gì), vừa là `key` để mỗi lần mở là một instance
   * mới — ảnh và ô chọn của lần trước không còn.
   */
  const [openedGroup, setOpenedGroup] = useState<OrganizationChargeGroup | null>(null)
  const [openToken, setOpenToken] = useState(0)
  const [payOpen, setPayOpen] = useState(false)

  const unpaidCharges = useMemo(
    () => group?.charges.filter((charge) => charge.paymentStatus === "unpaid") ?? [],
    [group],
  )
  const payable = Boolean(group?.bankAccount)

  function openPayDialog(): void {
    if (!group) return
    setOpenedGroup(group)
    setOpenToken((token) => token + 1)
    setPayOpen(true)
  }

  // Trả xong khoản cuối thì thanh biến mất luôn, kể cả đang mở: ở đây không còn gì để nói tiếp
  // như bên chốt giá — hộp thoại thanh toán đã tự báo "đã gửi" rồi.
  if (unpaidCount === 0) return null

  return (
    <>
      <NoticeBar
        tone="primary"
        icon={Wallet}
        action={expanded ? "Thu gọn" : "Xem"}
        onClick={onToggle}
        expanded={expanded}
        panel={
          <UnpaidChargesPanel
            charges={unpaidCharges}
            total={unpaidTotal}
            payable={payable}
            onPay={openPayDialog}
          />
        }
      >
        Bạn còn {unpaidCount} khoản chưa trả ·{" "}
        <span className="tabular-nums">{formatMoney(unpaidTotal)}đ</span>
      </NoticeBar>

      {/* KHÔNG tháo khi đóng: tháo lúc `open` về false là hộp thoại biến mất tức thì, không kịp
          chạy animation ra — cả tấm phủ cũng tắt phụp. */}
      {openedGroup ? (
        <PayDialog key={openToken} group={openedGroup} open={payOpen} onOpenChange={setPayOpen} />
      ) : null}
    </>
  )
}
