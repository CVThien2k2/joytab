"use client"

import { Receipt } from "lucide-react"
import { AccountAvatar } from "@/components/common/account-avatar"
import { PaymentProofDetail } from "@/components/common/payment-proof-detail"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogIconHeader,
} from "@/components/ui/dialog"
import { useLastPresent } from "@/hooks/use-last-present"
import { formatMoney } from "@/lib/format"
import type { MatchCharge } from "@/types/match"

/**
 * Input: khoản đang mở + tên người của khoản đó + id tổ chức và id trận đang xem.
 * Output: Ruột hộp thoại — hoặc chứng từ đầy đủ, hoặc câu giải thích khi không có chứng từ nào.
 */
function ProofBody({
  organizationId,
  matchId,
  charge,
}: {
  organizationId: string
  matchId: string
  charge: MatchCharge
}) {
  const person = (
    <div className="flex items-center gap-3">
      <AccountAvatar name={charge.fullName ?? "?"} src={charge.avatarUrl} size={40} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{charge.fullName ?? "Người đã rời"}</p>
        <p className="text-xs text-muted-foreground">
          Khoản của buổi này: {formatMoney(charge.amount)}đ
        </p>
      </div>
    </div>
  )

  // Không có chứng từ: khoản này sang `paid` lúc chốt giá vì owner tự đánh dấu, chứ không đi
  // qua một lần chuyển khoản nào. Nói thẳng ra thay vì để trống — một dòng "Đã trả" không giải
  // thích được là thứ sẽ bị hỏi lại sau vài tháng.
  if (!charge.paymentId) {
    return (
      <div className="space-y-3">
        {person}
        <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          Thanh toán này không có ảnh chuyển khoản. Khoản được chủ tổ chức tự đánh dấu đã trả lúc
          chốt giá, nên không có chứng từ nào để đối chiếu.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {person}
      <PaymentProofDetail
        organizationId={organizationId}
        paymentId={charge.paymentId}
        highlightMatchId={matchId}
      />
    </div>
  )
}

/**
 * Input: khoản đã trả + ngữ cảnh trận + trạng thái mở.
 * Output: Hộp thoại chứng từ của một khoản "Đã trả".
 *
 *         Chỉ ĐỌC — không có nút nào đổi được gì. Chứng từ là bản ghi bất biến: người trả tự
 *         ghi nhận, không ai duyệt và không ai rút lại.
 *
 *         Mở từ chính dòng của người đó trong bảng chia tiền, vì câu hỏi luôn bắt đầu ở đó:
 *         "dòng này ghi đã trả — trả bằng gì, lúc nào, và có phải trả cho buổi này không".
 */
export function PaymentProofDialog({
  organizationId,
  matchId,
  charge,
  open,
  onOpenChange,
}: {
  organizationId: string
  matchId: string
  charge: MatchCharge | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Khoản về null NGAY lúc đóng, trong khi Radix còn giữ hộp thoại thêm 150ms để chạy animation
  // ra — ruột rỗng đi rồi hộp co lại ngay trước lúc mờ. Giữ lại khoản vừa xem cho tới lần mở sau.
  const shown = useLastPresent(charge)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogIconHeader
          icon={Receipt}
          title="Chứng từ thanh toán"
          description="Ảnh chuyển khoản và những buổi mà lần chuyển đó trả cho. Chỉ để đối chiếu, không sửa được."
        />

        <DialogBody>
          {shown ? (
            <ProofBody organizationId={organizationId} matchId={matchId} charge={shown} />
          ) : null}
        </DialogBody>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
