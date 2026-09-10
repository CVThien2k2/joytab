"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useSettlement } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { formatMoney } from "@/lib/format"
import { matchPhase } from "@/lib/match-phase"
import type { MatchDetail } from "@/types/match"
import { SettlementDialog } from "./settlement-dialog"

/**
 * Input: chi tiết trận.
 * Output: Khu chi phí của trận, nhìn từ chủ tổ chức.
 *
 *         Hai trạng thái, và chỉ hai:
 *          - CHƯA chốt: một nút "Chốt chi phí" (kèm câu giải thích khi chưa bấm được);
 *          - ĐÃ chốt: các khoản đã chi + tổng, chỉ để đọc.
 *
 *         Không còn nhận `isOwner` hay `currentUserId`: trang chứa nó chỉ owner vào được, nên
 *         nhánh "người khác thấy lời nhắc" là nhánh chết. Và cũng không còn khối "bạn cần trả
 *         X" — trả tiền đi từ "Trận của tôi" hoặc dải nhắc nợ, chỗ nói về tiền CỦA MÌNH; ở đây
 *         người xem đang đứng ở vai người đi thu.
 *
 *         Chốt giá là MỘT lần: đã chốt rồi thì không còn nút sửa lại bảng chia tiền. Muốn đổi
 *         thì đó là một quyết định phải nói ra ngoài phần mềm, không phải một ô sửa im lặng
 *         trong khi có người đã cầm con số cũ đi chuyển khoản.
 *
 *         Tiền của TỪNG NGƯỜI không nằm ở đây mà hiện ngay trên dòng của họ trong danh sách
 *         người tham gia: hai danh sách cùng một nhóm người thì người ta phải dò tên từ bảng
 *         này sang bảng kia mới trả lời được "ai trả bao nhiêu".
 */
export function SettlementSection({ match }: { match: MatchDetail }) {
  const now = useNow()
  const [dialogOpen, setDialogOpen] = useState(false)
  // Đổi `key` mỗi lần mở để hộp thoại dựng lại với bảng chi phí mới nhất. Hộp thoại vẫn nằm sẵn
  // trong cây (đóng/mở có animation), chỉ RUỘT của nó là mới — nên không cần effect nào để nạp
  // lại state, và cũng không có cảnh mở lần hai thấy dữ liệu lần một.
  const [openToken, setOpenToken] = useState(0)

  function openDialog(): void {
    setOpenToken((token) => token + 1)
    setDialogOpen(true)
  }
  const settled = match.status === "settled"
  const { data: settlement, isPending } = useSettlement(match.id, settled)
  const phase = matchPhase(match, now)
  const started = phase !== "upcoming"

  if (!settled) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Chi phí</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {match.status === "canceled"
            ? "Trận đã huỷ nên không có chi phí."
            : started
              ? `${phase === "ended" ? "Trận đã kết thúc" : "Trận đang diễn ra"}. Nhập chi phí để chia tiền cho những người đã đăng ký.`
              : "Chốt chi phí được sau khi trận bắt đầu."}
        </p>

        {started && match.status !== "canceled" ? (
          <>
            <Button type="button" className="mt-3" onClick={openDialog}>
              <Receipt aria-hidden="true" />
              Chốt chi phí
            </Button>
            {/* Dựng sẵn, không `dialogOpen ? … : null`: mount lúc mở thì không có animation vào,
                unmount lúc đóng thì hộp thoại BIẾN MẤT giữa animation ra. Radix tự lo việc chỉ
                mount ruột khi mở, và `SettlementDialog` nạp lại state mỗi lần `open` bật. */}
            <SettlementDialog
              key={openToken}
              match={match}
              organizationId={match.organizationId}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              initialExpenses={[]}
              initialMaleRatio={match.maleRatio}
            />
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

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="border-b p-4">
        <h2 className="text-sm font-semibold">Chi phí</h2>
        <p className="text-xs text-muted-foreground">
          Tổng {formatMoney(settlement.total)}đ · hệ số nam ×{settlement.maleRatio}
          {settlement.surplus > 0 ? ` · dư ${formatMoney(settlement.surplus)}đ vào quỹ` : ""}
        </p>
      </header>

      <ul className="divide-y">
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
    </section>
  )
}
