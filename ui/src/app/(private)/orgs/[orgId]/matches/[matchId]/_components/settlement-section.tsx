"use client"

import { useState } from "react"
import Link from "next/link"
import { Receipt } from "lucide-react"
import { AccountAvatar } from "@/components/common/account-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useSettlement } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { formatMoney } from "@/lib/format"
import type { MatchDetail } from "@/types/match"
import { SettlementDialog } from "./settlement-dialog"

/** Nhãn trạng thái trả tiền của MỘT người trong bảng chia tiền — góc nhìn của chủ tổ chức. */
function chargeBadge(status: "unpaid" | "submitted" | "confirmed") {
  if (status === "confirmed") return <Badge variant="secondary">Đã đối soát</Badge>
  if (status === "submitted") return <Badge variant="outline">Chờ duyệt</Badge>
  return <Badge variant="destructive">Chưa trả</Badge>
}

/**
 * Input: chi tiết trận + có phải chủ tổ chức không + id người đang xem.
 * Output: Khu chi phí của trận.
 *
 *         Ba trạng thái, ba nội dung khác nhau:
 *          - chưa tới giờ chơi: nói rõ là chốt được sau khi trận bắt đầu, không hiện nút chết;
 *          - đã đá xong mà chưa chốt: chủ tổ chức thấy nút chốt, người khác thấy lời nhắc;
 *          - đã chốt: bảng chi phí + tiền từng người, và với chính mình thì thêm đường sang
 *            trang thanh toán.
 */
export function SettlementSection({
  match,
  isOwner,
  currentUserId,
}: {
  match: MatchDetail
  isOwner: boolean
  currentUserId: string
}) {
  const now = useNow()
  const [dialogOpen, setDialogOpen] = useState(false)
  const settled = match.status === "settled"
  const { data: settlement, isPending } = useSettlement(match.id, settled)
  const started = new Date(match.startAt).getTime() <= now

  if (!settled) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Chi phí</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {match.status === "canceled"
            ? "Trận đã huỷ nên không có chi phí."
            : started
              ? isOwner
                ? "Trận đã diễn ra. Nhập chi phí để chia tiền cho những người đã đăng ký."
                : "Chủ tổ chức chưa chốt chi phí cho trận này."
              : "Chốt chi phí được sau khi trận bắt đầu."}
        </p>

        {isOwner && started && match.status !== "canceled" ? (
          <>
            <Button type="button" className="mt-3" onClick={() => setDialogOpen(true)}>
              <Receipt aria-hidden="true" />
              Chốt chi phí
            </Button>
            {dialogOpen ? (
              <SettlementDialog
                match={match}
                organizationId={match.organizationId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initialExpenses={[]}
                initialMaleRatio={match.maleRatio}
              />
            ) : null}
          </>
        ) : null}
      </section>
    )
  }

  if (isPending || !settlement) {
    return (
      <section className="flex h-32 items-center justify-center rounded-xl border bg-card">
        <Spinner className="size-5 text-muted-foreground" />
      </section>
    )
  }

  const myCharge = settlement.charges.find((charge) => charge.userId === currentUserId)

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Chi phí</h2>
          <p className="text-xs text-muted-foreground">
            Tổng {formatMoney(settlement.total)}đ · hệ số nam ×{settlement.maleRatio}
            {settlement.surplus > 0 ? ` · dư ${formatMoney(settlement.surplus)}đ vào quỹ` : ""}
          </p>
        </div>

        {isOwner ? (
          settlement.editable ? (
            <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
              Sửa chia tiền
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Đã có người gửi thanh toán nên không sửa được. Từ chối lần thanh toán đó trước nếu
              cần sửa.
            </p>
          )
        ) : null}
      </header>

      <ul className="divide-y border-b">
        {settlement.expenses.map((expense, index) => (
          <li key={index} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{expense.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {expense.quantity} × {formatMoney(expense.unitPrice)}đ
            </span>
            <span className="w-28 shrink-0 text-right font-medium tabular-nums">
              {formatMoney(expense.quantity * expense.unitPrice)}đ
            </span>
          </li>
        ))}
      </ul>

      <ul className="divide-y">
        {settlement.charges.map((charge) => {
          const name = charge.fullName ?? "Thành viên"
          return (
            <li key={charge.userId} className="flex items-center gap-3 p-3">
              <AccountAvatar name={name} src={charge.avatarUrl} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {name}
                {charge.userId === currentUserId ? (
                  <span className="ml-1 text-xs text-muted-foreground">(Bạn)</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">×{charge.ratio}</span>
              {chargeBadge(charge.paymentStatus)}
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(charge.amount)}đ
              </span>
            </li>
          )
        })}
      </ul>

      {myCharge && myCharge.paymentStatus === "unpaid" ? (
        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 p-4">
          <p className="min-w-0 flex-1 text-sm">
            Bạn cần trả <span className="font-semibold">{formatMoney(myCharge.amount)}đ</span> cho
            trận này.
          </p>
          <Button asChild>
            <Link href={`/orgs/${match.organizationId}/payments`}>Thanh toán</Link>
          </Button>
        </div>
      ) : null}

      {dialogOpen ? (
        <SettlementDialog
          match={match}
          organizationId={match.organizationId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialExpenses={settlement.expenses}
          initialMaleRatio={settlement.maleRatio}
        />
      ) : null}
    </section>
  )
}
