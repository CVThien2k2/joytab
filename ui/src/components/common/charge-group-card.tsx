"use client"

import { useState } from "react"
import Link from "next/link"
import { CircleAlert, Clock3, CircleCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PayDialog } from "@/components/common/pay-dialog"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { OrganizationChargeGroup, UserCharge } from "@/types/payment"

/** Nhãn trạng thái NHÌN TỪ PHÍA NGƯỜI TRẢ: gửi rồi là đã trả xong, phần đối soát là việc của chủ tổ chức. */
function statusBadge(charge: UserCharge) {
  if (charge.paymentStatus === "confirmed") {
    return (
      <Badge variant="secondary">
        <CircleCheck aria-hidden="true" />
        Đã đối soát
      </Badge>
    )
  }
  if (charge.paymentStatus === "submitted") {
    return (
      <Badge variant="outline">
        <Clock3 aria-hidden="true" />
        Đã thanh toán
      </Badge>
    )
  }
  return null
}

/**
 * Input: công nợ của user trong MỘT tổ chức.
 * Output: Thẻ "bạn đang nợ X" kèm danh sách khoản và nút thanh toán.
 *
 *         Một thẻ cho một tổ chức vì một lần chuyển khoản chỉ trả được cho một tổ chức — QR
 *         khác nhau. Gộp tổng toàn hệ thống thành một con số thì đẹp nhưng không chuyển khoản
 *         được, nên đó không phải đơn vị đúng.
 *
 *         Dùng chung cho trang thanh toán cá nhân (nhiều thẻ) và trang thanh toán của tổ chức
 *         (một thẻ).
 */
export function ChargeGroupCard({ group }: { group: OrganizationChargeGroup }) {
  const [payOpen, setPayOpen] = useState(false)
  const hasUnpaid = group.charges.some((charge) => charge.paymentStatus === "unpaid")

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/orgs/${group.organizationId}/payments`}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {group.organizationName}
          </Link>
          <p className="text-xs text-muted-foreground">
            {hasUnpaid
              ? `Đang nợ ${formatMoney(group.unpaidTotal)}đ`
              : "Đã thanh toán hết, chờ đối soát"}
          </p>
        </div>

        {hasUnpaid ? (
          group.paymentQrUrl ? (
            <Button type="button" onClick={() => setPayOpen(true)}>
              Thanh toán {formatMoney(group.unpaidTotal)}đ
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tổ chức chưa có mã QR — nhắc chủ tổ chức cấu hình
            </p>
          )
        ) : null}
      </header>

      <ul className="divide-y">
        {group.charges.map((charge) => (
          <li key={charge.chargeId} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link
                href={`/orgs/${group.organizationId}/matches/${charge.matchId}`}
                className="block truncate text-sm font-medium hover:underline"
              >
                {charge.courtName}
              </Link>
              <p className="text-xs text-muted-foreground">{formatDateTime(charge.startAt)}</p>
              {charge.rejectReason ? (
                <p className="mt-1 flex items-start gap-1 text-xs text-destructive">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>Chủ tổ chức báo chưa nhận được: {charge.rejectReason}</span>
                </p>
              ) : null}
            </div>

            {statusBadge(charge)}
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(charge.amount)}đ
            </span>
          </li>
        ))}
      </ul>

      {payOpen ? <PayDialog group={group} open={payOpen} onOpenChange={setPayOpen} /> : null}
    </section>
  )
}
