"use client"

import { AccountAvatar } from "@/components/common/account-avatar"
import { Spinner } from "@/components/ui/spinner"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { Payment } from "@/types/payment"

/**
 * Input: sổ chứng từ + trạng thái tải.
 * Output: Danh sách các lần đã chuyển khoản, mới nhất trước.
 *
 *         KHÔNG có thao tác nào ở đây — không duyệt, không từ chối, không bỏ duyệt. Người trả
 *         tự ghi nhận đã chuyển, nên đây là sổ để ĐỌC: ai trả bao nhiêu, cho những buổi nào,
 *         kèm ảnh chuyển khoản để đối chiếu khi có tranh cãi.
 *
 *         Mỗi dòng nói rõ lần chuyển khoản này trả cho những trận nào: một ảnh có thể gom nhiều
 *         buổi, mà con số trên ảnh chỉ có nghĩa khi biết nó ứng với những gì.
 */
export function PaymentList({
  payments,
  loading,
  emptyText,
}: {
  payments: Payment[]
  loading?: boolean
  emptyText: string
}) {
  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border bg-card">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {payments.map((payment) => {
        const name = payment.fullName ?? "Thành viên"
        return (
          <li key={payment.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <AccountAvatar name={name} src={payment.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">
                  Trả {formatDateTime(payment.submittedAt)} · {payment.items.length} trận
                </p>
              </div>
              <span className="shrink-0 text-base font-bold tabular-nums">
                {formatMoney(payment.total)}đ
              </span>
            </div>

            <div className="flex flex-wrap gap-4 border-t p-4">
              <a
                href={payment.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border p-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={payment.proofUrl}
                  alt={`Ảnh chuyển khoản của ${name}`}
                  className="size-24 rounded object-contain"
                />
              </a>

              <div className="min-w-0 flex-1 space-y-1">
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {payment.items.map((item) => (
                    <li key={item.matchId} className="truncate">
                      {item.courtName} · {formatDateTime(item.startAt)} · {formatMoney(item.amount)}
                      đ
                    </li>
                  ))}
                </ul>
                {payment.note ? <p className="text-xs">Ghi chú: {payment.note}</p> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
