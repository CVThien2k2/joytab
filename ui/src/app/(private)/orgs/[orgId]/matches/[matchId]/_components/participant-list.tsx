"use client"

import { AccountAvatar } from "@/components/common/account-avatar"
import { Badge } from "@/components/ui/badge"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { MatchCharge, MatchParticipant } from "@/types/match"

/** Nhãn giới tính — chỉ để người xem hiểu vì sao hai người cùng trận đóng khác nhau. */
const GENDER_LABEL: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" }

/** Nhãn trạng thái trả tiền của MỘT người. Hai mức — không ai duyệt, nên không có mức ở giữa. */
function paymentBadge(status: MatchCharge["paymentStatus"]) {
  if (status === "paid") return <Badge variant="secondary">Đã trả</Badge>
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
  participants,
  currentUserId,
  charges = [],
}: {
  participants: MatchParticipant[]
  currentUserId: string
  charges?: MatchCharge[]
}) {
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Chưa ai đăng ký. Bạn có thể là người đầu tiên.
      </div>
    )
  }

  const chargeByUser = new Map(charges.map((charge) => [charge.userId, charge]))

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {participants.map((participant) => {
        const name = participant.fullName ?? "Thành viên"
        const charge = chargeByUser.get(participant.userId)
        return (
          <li key={participant.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
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
              <Badge variant="outline">{GENDER_LABEL[participant.gender]}</Badge>
            ) : null}

            {charge ? (
              <>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  ×{charge.ratio}
                </span>
                {paymentBadge(charge.paymentStatus)}
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(charge.amount)}đ
                </span>
              </>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
