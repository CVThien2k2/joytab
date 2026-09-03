"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PayDialog } from "@/components/common/pay-dialog"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { OrganizationChargeGroup } from "@/types/payment"

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
  // BE chỉ trả về khoản CHƯA trả (trả rồi thì thuộc sổ chứng từ), nhưng vẫn kiểm ở đây thay vì
  // tin vào điều đó: một thẻ "đang nợ 0đ" kèm nút thanh toán là thứ không ai giải thích được.
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
            {hasUnpaid ? `Đang nợ ${formatMoney(group.unpaidTotal)}đ` : "Đã trả hết"}
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
            </div>

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
