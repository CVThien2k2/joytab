"use client"

import Link from "next/link"
import { MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDayLabel, formatMoney, formatTime } from "@/lib/format"
import { matchDetailPath } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { OrganizationHistoryMatch } from "@/types/match"

/**
 * Buổi này còn việc gì cho chủ tổ chức. Bốn mức, và chỉ bốn:
 *
 *  - `unsettled`: đã đá xong mà chưa chốt giá — việc còn phải LÀM.
 *  - `uncollected`: đã chốt giá nhưng còn người chưa trả — việc còn phải ĐÒI.
 *  - `collected`: đã chốt và thu đủ. Xong hẳn.
 *  - `canceled`: buổi bị huỷ, không có việc nào.
 *
 * Đây là trục DUY NHẤT của thẻ này, và nó khác trục của thẻ ở "Trận của tôi" (đã trả / chưa
 * trả). Cùng một buổi, hai trang hỏi hai câu: bên kia là "mình nợ chưa", bên này là "mình còn
 * phải làm gì với buổi này".
 */
type WorkState = "unsettled" | "uncollected" | "collected" | "canceled"

function workStateOf(match: OrganizationHistoryMatch): WorkState {
  if (match.status === "canceled") return "canceled"
  // Danh sách này chỉ chứa buổi đã là quá khứ, nên `open` ở đây luôn là "đã đá xong mà chưa
  // chốt" — không phải kiểm giờ lại lần nữa (BE đã cắt theo `end_at`).
  if (match.status !== "settled") return "unsettled"
  return match.paidCount >= match.chargeCount ? "collected" : "uncollected"
}

/**
 * Màu viền + vạch dọc bên trái, và nhãn ở mép phải.
 *
 * Hai mức CÒN VIỆC có màu, hai mức đã xong thì không: đỏ = còn người chưa trả, hổ phách = chưa
 * chốt giá. Buổi đã thu đủ và buổi đã huỷ để trơn — tô màu cho chúng là kéo mắt về những dòng
 * không cần hành động, đúng thứ một danh sách việc phải làm không nên làm.
 *
 * Chưa chốt giá KHÔNG dùng màu đỏ dù nó cũng là việc treo: đỏ ở đây đã có nghĩa "tiền chưa
 * về", mà hai việc khác nhau cùng một màu thì cả trang chỉ còn một tín hiệu.
 */
const WORK_STYLE: Record<
  WorkState,
  {
    border: string
    rail: string
    label: string
    variant: "success" | "destructive" | "outline" | "warning"
  }
> = {
  unsettled: {
    border: "border-amber-500/45",
    rail: "bg-amber-500",
    label: "Chưa chốt giá",
    variant: "warning",
  },
  uncollected: {
    border: "border-destructive/45",
    rail: "bg-destructive",
    label: "Chưa thu hết",
    variant: "destructive",
  },
  collected: {
    border: "border-border",
    rail: "bg-transparent",
    label: "Đã thu đủ",
    variant: "success",
  },
  canceled: {
    border: "border-border",
    rail: "bg-transparent",
    label: "Đã huỷ",
    variant: "outline",
  },
}

/**
 * Input: một buổi đã qua của tổ chức, nhìn từ chủ tổ chức.
 * Output: Một dòng trong sổ điều hành.
 *
 *         Thẻ RIÊNG, không dùng chung với thẻ ở "Trận của tôi": bên kia hiện tiền CỦA MÌNH và
 *         cả thẻ trơ vì buổi đã xong thì không còn việc gì; bên này hiện tiền của CẢ BUỔI kèm
 *         tiến độ thu, và luôn có một đích bấm dẫn sang chỗ làm việc đó.
 *
 *         Bốn khối đọc từ trái sang, mỗi khối một câu hỏi: KHI NÀO — Ở ĐÂU (kèm sĩ số) — TIỀN
 *         THẾ NÀO — rồi tới nút.
 *
 *         Không phải một `button` bọc cả thẻ: đích bấm là NÚT, hiện rõ ở mép phải. Cả thẻ bấm
 *         được thì không nói ra được là bấm sẽ đi đâu, mà đây là danh sách người ta lướt để
 *         TÌM việc chứ không phải để mở từng dòng.
 */
export function OrgHistoryCard({ match }: { match: OrganizationHistoryMatch }) {
  const work = WORK_STYLE[workStateOf(match)]
  // Tiền chỉ có nghĩa khi đã chốt giá. Buổi chưa chốt và buổi đã huỷ đều có `totalAmount = 0`,
  // mà hiện "0đ" ở đó là nói rằng buổi đó miễn phí — trong khi thật ra chưa có con số nào.
  const settled = match.status === "settled"

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-card py-4 pr-4 pl-6 shadow-sm",
        work.border,
      )}
    >
      {/* Vạch dọc bám mép trái, nằm trong một lớp tự cắt — cùng công thức với thẻ ở "Trận của
          tôi" (xem chú thích ở đó về bán kính 15px). */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[15px]"
        aria-hidden="true"
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", work.rail)} />
      </span>

      {/* Ngày + khung giờ. Mono để mọi hàng thẳng cột, cùng công thức với hai danh sách kia. */}
      <span className="flex shrink-0 flex-col justify-center gap-0.5 sm:w-[132px]">
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {formatDayLabel(match.startAt)}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[15px] font-semibold">
          {formatTime(match.startAt)}
          <span className="text-muted-foreground">–</span>
          {formatTime(match.endAt)}
        </span>
      </span>

      {/* Sân + địa chỉ + sĩ số. `basis-55` để nó là khối xuống dòng đầu tiên khi thẻ hẹp lại. */}
      <span className="flex min-w-0 flex-1 basis-55 flex-col gap-1">
        <span className="truncate text-[15px] font-semibold tracking-tight">{match.courtName}</span>

        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1.5">
            <Users className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              {match.playerCount}/{match.maxPlayers} người
            </span>
          </span>

          {/* Địa chỉ chỉ hiện khi có: trận cũ tạo trước khi có ô này thì để trống. */}
          {match.address ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{match.address}</span>
            </span>
          ) : null}
        </span>
      </span>

      {/* Tiền của CẢ buổi + tiến độ thu. Số nằm trên, nhãn dưới, canh phải để thẳng cột đơn vị. */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        {settled ? (
          <>
            <span className="font-mono text-[15px] font-semibold tabular-nums">
              {formatMoney(match.totalAmount)}
              <span className="ml-0.5 text-muted-foreground">đ</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {match.paidCount}/{match.chargeCount} đã trả
            </span>
          </>
        ) : null}
        <Badge variant={work.variant}>{work.label}</Badge>
      </span>

      {/* Đích bấm duy nhất của thẻ. Cùng một nút cho mọi trạng thái — trang chi tiết tự biết
          hiện nút chốt giá hay bảng chia tiền, nên ở đây không phải đoán trước. */}
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={matchDetailPath(match.organizationId, match.id)}>Xem chi tiết</Link>
      </Button>
    </div>
  )
}
