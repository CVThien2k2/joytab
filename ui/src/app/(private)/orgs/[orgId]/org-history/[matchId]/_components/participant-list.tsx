"use client"

import { useState } from "react"
import { AccountAvatar } from "@/components/common/account-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatMoney } from "@/lib/format"
import { GENDER_LABELS } from "@/lib/gender"
import type { MatchCharge, MatchParticipant } from "@/types/match"
import { PaymentProofDialog } from "./payment-proof-dialog"

/**
 * Nhãn trạng thái trả tiền của MỘT người. Hai mức — không ai duyệt, nên không có mức ở giữa.
 *
 * Xanh / đỏ, cùng bộ màu với thẻ ở "Trận của tôi": cùng một câu "đã trả chưa" mà hai màn hình
 * tô hai màu khác nhau là chỗ người ta bắt đầu phải đọc chữ mới dám tin.
 */
function paymentBadge(status: MatchCharge["paymentStatus"]) {
  if (status === "paid") return <Badge variant="success">Đã trả</Badge>
  return <Badge variant="destructive">Chưa trả</Badge>
}

/**
 * Input: danh sách người tham gia + (khi đã chốt tiền) bảng chia tiền của trận.
 * Output: Một danh sách duy nhất: ai đi, và người đó phải trả bao nhiêu.
 *
 *         Tiền hiện NGAY trên dòng của từng người chứ không thành một bảng riêng bên dưới: hai
 *         danh sách cùng một nhóm người, đọc xong danh sách trên rồi phải dò tên xuống danh
 *         sách dưới mới biết ai trả bao nhiêu — mà đó lại là câu duy nhất người ta hỏi sau khi
 *         trận đã chốt tiền.
 *
 *         Chưa chốt tiền thì `charges` rỗng và dòng người tham gia trở lại như cũ (giờ đăng ký
 *         + giới tính).
 */
export function ParticipantList({
  organizationId,
  matchId,
  participants,
  currentUserId,
  charges = [],
}: {
  organizationId: string
  matchId: string
  participants: MatchParticipant[]
  currentUserId: string
  charges?: MatchCharge[]
}) {
  // Khoản đang mở trong hộp thoại chứng từ. `null` = đang đóng.
  //
  // Giữ cả object chứ không riêng id: hộp thoại cần tên, avatar và số tiền của khoản để hiện
  // ngay, kể cả trong lúc chứng từ còn đang tải — mà cả ba thứ đó đã nằm sẵn ở đây.
  const [proofCharge, setProofCharge] = useState<MatchCharge | null>(null)
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Không ai đăng ký buổi này.
      </div>
    )
  }

  const chargeByUser = new Map(charges.map((charge) => [charge.userId, charge]))

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {participants.map((participant) => {
          const name = participant.fullName ?? "Thành viên"
          const charge = chargeByUser.get(participant.userId)
          return (
            <li
              key={participant.userId}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
            >
              <AccountAvatar name={name} src={participant.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {participant.userId === currentUserId ? (
                    <span className="ml-1 text-xs text-muted-foreground">(Bạn)</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  Đăng ký {formatDateTime(participant.votedAt)}
                </p>
              </div>

              {participant.gender ? (
                <Badge variant="outline">{GENDER_LABELS[participant.gender]}</Badge>
              ) : null}

              {charge ? (
                <>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    ×{charge.ratio}
                  </span>
                  {paymentBadge(charge.paymentStatus)}

                  {/* Chỉ dòng ĐÃ TRẢ mới có đường xem chứng từ: dòng chưa trả thì chưa có gì để
                    đọc. Nút nằm ngay cạnh nhãn vì nó trả lời đúng câu nhãn đó gợi ra. */}
                  {charge.paymentStatus === "paid" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setProofCharge(charge)}
                    >
                      Xem chi tiết
                    </Button>
                  ) : null}

                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(charge.amount)}đ
                  </span>
                </>
              ) : null}
            </li>
          )
        })}
      </ul>

      {/* MỘT hộp thoại cho cả danh sách, không phải một cái trên mỗi dòng: chỉ mở được một lần
          một, mà dựng sẵn n hộp thoại cho n người là n cây Radix nằm chờ không ai dùng. */}
      <PaymentProofDialog
        organizationId={organizationId}
        matchId={matchId}
        charge={proofCharge}
        open={proofCharge !== null}
        onOpenChange={(next) => {
          if (!next) setProofCharge(null)
        }}
      />
    </>
  )
}
