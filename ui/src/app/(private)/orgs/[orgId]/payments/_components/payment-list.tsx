"use client"

import { useState } from "react"
import { AccountAvatar } from "@/components/common/account-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useConfirmPayment, useUnconfirmPayment } from "@/hooks/use-payments-api"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { Payment } from "@/types/payment"
import { RejectPaymentDialog } from "./reject-payment-dialog"

function statusBadge(status: Payment["status"]) {
  if (status === "confirmed") return <Badge variant="secondary">Đã duyệt</Badge>
  if (status === "rejected") return <Badge variant="destructive">Đã từ chối</Badge>
  return <Badge variant="outline">Chờ duyệt</Badge>
}

/**
 * Input: danh sách lần thanh toán + có phải chủ tổ chức không.
 * Output: Danh sách chứng từ. Chủ tổ chức có thêm nút Duyệt / Báo chưa nhận, và nút Bỏ duyệt
 *         cho lần đã duyệt nhầm.
 *
 *         Mỗi dòng nói rõ lần chuyển khoản này trả cho những trận nào: một ảnh có thể gom
 *         nhiều buổi, mà đối soát thì phải biết số tiền trên ảnh ứng với những gì.
 */
export function PaymentList({
  payments,
  organizationId,
  isOwner,
  loading,
  emptyText,
}: {
  payments: Payment[]
  organizationId: string
  isOwner: boolean
  loading?: boolean
  emptyText: string
}) {
  const [rejecting, setRejecting] = useState<string | null>(null)
  const confirmPayment = useConfirmPayment(organizationId)
  const unconfirmPayment = useUnconfirmPayment(organizationId)

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
    <>
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
                    Gửi {formatDateTime(payment.submittedAt)} · {payment.items.length} trận
                  </p>
                </div>
                {statusBadge(payment.status)}
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
                        {item.courtName} · {formatDateTime(item.startAt)} ·{" "}
                        {formatMoney(item.amount)}đ
                      </li>
                    ))}
                  </ul>
                  {payment.note ? <p className="text-xs">Ghi chú: {payment.note}</p> : null}
                  {payment.rejectReason ? (
                    <p className="text-xs text-destructive">Lý do: {payment.rejectReason}</p>
                  ) : null}
                </div>

                {isOwner ? (
                  <div className="flex shrink-0 flex-wrap items-start gap-2">
                    {payment.status === "submitted" ? (
                      <>
                        <Button
                          type="button"
                          disabled={confirmPayment.isPending}
                          onClick={() => confirmPayment.mutate(payment.id)}
                        >
                          Đã nhận được
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRejecting(payment.id)}
                        >
                          Chưa nhận được
                        </Button>
                      </>
                    ) : null}
                    {payment.status === "confirmed" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={unconfirmPayment.isPending}
                        onClick={() => unconfirmPayment.mutate(payment.id)}
                      >
                        Bỏ duyệt
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {rejecting ? (
        <RejectPaymentDialog
          organizationId={organizationId}
          paymentId={rejecting}
          open={Boolean(rejecting)}
          onOpenChange={(open) => !open && setRejecting(null)}
        />
      ) : null}
    </>
  )
}
