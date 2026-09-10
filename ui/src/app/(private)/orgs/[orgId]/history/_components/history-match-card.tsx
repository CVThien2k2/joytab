"use client"

import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDayLabel, formatMoney, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types/match"

/**
 * Khoản của người đang xem ở một buổi đã qua. Bốn mức, và chỉ bốn:
 *
 *  - `paid`: đã trả.
 *  - `unpaid`: đã chốt tiền, mình còn nợ.
 *  - `pending`: buổi đã đá xong nhưng chủ tổ chức chưa chốt tiền — chưa biết phải trả bao nhiêu.
 *  - `canceled`: buổi bị huỷ, không có tiền nào.
 *
 * Đây là trục DUY NHẤT của thẻ lịch sử. Thẻ ở trang chủ tô màu theo chỗ ngồi (còn chỗ / hết
 * chỗ / đã đăng ký) vì lúc đó câu hỏi là "mình vào được không"; tới trang này buổi đã đá xong
 * rồi, câu duy nhất còn lại là "mình trả chưa".
 */
type MoneyState = "paid" | "unpaid" | "pending" | "canceled"

function moneyStateOf(match: MatchSummary): MoneyState {
  if (match.status === "canceled") return "canceled"
  if (match.myPaymentStatus === null) return "pending"
  return match.myPaymentStatus
}

/**
 * Màu viền + vạch dọc bên trái, và nhãn ở mép phải.
 *
 * Xanh = đã trả, ĐỎ = chưa trả. Hai mức còn lại KHÔNG có màu: chưa chốt tiền và đã huỷ đều là
 * "chưa có gì phải làm", mà tô màu cho chúng là kéo mắt về những dòng không cần hành động —
 * đúng thứ mà một sổ nợ không nên làm.
 */
const MONEY_STYLE: Record<
  MoneyState,
  { border: string; rail: string; label: string; variant: "success" | "destructive" | "outline" }
> = {
  paid: {
    border: "border-green-500/45",
    rail: "bg-green-500",
    label: "Đã trả",
    variant: "success",
  },
  unpaid: {
    border: "border-destructive/45",
    rail: "bg-destructive",
    label: "Chưa trả",
    variant: "destructive",
  },
  pending: {
    border: "border-border",
    rail: "bg-transparent",
    label: "Chưa chốt tiền",
    variant: "outline",
  },
  canceled: {
    border: "border-border",
    rail: "bg-transparent",
    label: "Đã huỷ",
    variant: "outline",
  },
}

/**
 * Input: một buổi đã qua của CHÍNH người đang xem + hàm mở hộp thoại khoản của buổi đó.
 * Output: Một dòng trong sổ lịch sử.
 *
 *         Thẻ RIÊNG, không dùng `MatchCard` của trang chủ. Ở đây không có avatar người tham
 *         gia, không có sĩ số, không có nhãn "Đã đăng ký", không nút đăng ký và không nút
 *         sửa/huỷ — buổi đã đá xong thì chẳng còn việc nào để làm với nó ngoài chuyện tiền
 *         nong. Nhồi sáu cái cờ tắt-bật vào thẻ kia để nó vừa hai chỗ dùng sẽ khó đọc hơn hẳn
 *         một thẻ riêng chỉ làm một việc.
 *
 *         Bốn khối đọc từ trái sang, mỗi khối một câu hỏi:
 *
 *          1. KHI NÀO — thứ, ngày, khung giờ. Chữ mono, rộng cố định nên mọi hàng thẳng cột.
 *          2. Ở ĐÂU — tên sân, dưới là địa chỉ.
 *          3. Nút "Chi tiết" — mở cách chia tiền và chứng từ của buổi đó.
 *          4. BAO NHIÊU — số tiền của mình kèm nhãn đã trả / chưa trả, ghim ở mép phải.
 *
 *         Hai khối cuối đều là ô RỘNG CỐ ĐỊNH, nên cả cột nút và cột tiền thẳng hàng qua mọi
 *         hàng của danh sách.
 *
 *         Thẻ vẫn KHÔNG phải một `button`: chỉ cái nút bấm được, còn cả thẻ thì trơ, không đổi
 *         màu khi rê chuột và không nhận tiêu điểm bàn phím. Cho cả thẻ bấm được thì hai đích
 *         bấm lồng nhau, mà một thẻ sáng lên lúc hover cũng là lời hứa rằng bấm CHỖ NÀO cũng
 *         mở được — trong khi nửa số hàng không có gì để mở.
 */
export function HistoryMatchCard({
  match,
  onOpenDetail,
}: {
  match: MatchSummary
  onOpenDetail: (match: MatchSummary) => void
}) {
  const moneyState = moneyStateOf(match)
  const money = MONEY_STYLE[moneyState]

  /**
   * Chỉ buổi ĐÃ CHỐT TIỀN mới có gì để mở: hộp thoại đọc bảng chia tiền, mà buổi chưa chốt thì
   * BE chưa có bảng nào (MATCH_013) còn buổi đã huỷ thì không bao giờ có. Hiện một cái nút mở
   * ra hộp rỗng còn tệ hơn là không có nút.
   */
  const canOpenDetail = moneyState === "paid" || moneyState === "unpaid"

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-card py-4 pr-4 pl-6 shadow-sm",
        money.border,
      )}
    >
      {/* Vạch dọc bám mép trái. Nằm trong một lớp TỰ CẮT thay vì tự bo góc: một dải rộng 4px
          không bo nổi bán kính 16px của thẻ (CSS co bán kính lại cho vừa bề rộng), nên góc
          vuông của nó thò ra ngoài đúng chỗ mép thẻ đang cong. 15px = 16px bo của thẻ trừ 1px
          viền, tức đúng đường cong phía trong. */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[15px]"
        aria-hidden="true"
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", money.rail)} />
      </span>

      {/* Ngày + khung giờ. Mono để chữ số nào cũng cùng bề rộng — cả cột thẳng hàng như một
          bảng. Cùng công thức với thẻ ở trang chủ, nên hai danh sách đọc như một. */}
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

      {/* Sân + địa chỉ. `basis-55` để nó là khối XUỐNG DÒNG đầu tiên khi thẻ hẹp lại — giờ và
          tiền thì không co được, còn tên sân thì cắt bớt vẫn đọc được. */}
      <span className="flex min-w-0 flex-1 basis-55 flex-col gap-1">
        <span className="truncate text-[15px] font-semibold tracking-tight">{match.courtName}</span>

        {/* Địa chỉ chỉ hiện khi có: trận cũ tạo trước khi có ô này thì để trống, mà một dòng
            trống kèm icon ghim còn khó hiểu hơn là không có dòng nào. */}
        {match.address ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{match.address}</span>
          </span>
        ) : null}
      </span>

      {/* Nút đứng ngay TRƯỚC khối tiền, không phải ở mép ngoài cùng: nó là câu hỏi về con số
          bên cạnh nó ("vì sao lại là số này"), nên đặt cạnh con số thì rõ nó nói về cái gì,
          còn đẩy ra cuối hàng thì nó thành một cái nút chung của cả dòng.

          Từ `sm` trở lên ô vẫn chiếm chỗ dù hàng đó không có nút, để cột nút thẳng hàng qua các
          hàng; dưới `sm` thì bỏ hẳn — lúc ấy các khối đã xuống dòng nên không còn cột nào để
          thẳng, mà một ô rỗng chỉ để lại khoảng hở không ai giải thích được. */}
      <span
        className={cn("shrink-0 justify-end sm:flex sm:w-20", canOpenDetail ? "flex" : "hidden")}
      >
        {canOpenDetail ? (
          <Button variant="outline" size="sm" onClick={() => onOpenDetail(match)}>
            Chi tiết
          </Button>
        ) : null}
      </span>

      {/* Tiền. Số nằm TRÊN nhãn và to hơn: con số là thứ người ta lướt cả trang để tìm, còn
          nhãn chỉ nói con số đó đã xong chưa. Canh phải để mọi hàng số thẳng cột đơn vị, và
          RỘNG CỐ ĐỊNH vì khối sân bên trái là khối co giãn — để khối này tự co theo chữ thì
          nhãn dài ngắn khác nhau ("Đã trả" so với "Chưa chốt tiền") sẽ đẩy cái nút sang một
          chỗ khác nhau ở từng hàng. */}
      <span className="flex shrink-0 flex-col items-end gap-1 sm:w-28">
        {/* Chưa chốt tiền / đã huỷ thì KHÔNG hiện "0đ": số không là một con số, mà ở đây đang
            là chưa có con số nào — hai chuyện khác nhau, và người đọc sẽ tưởng mình được miễn. */}
        {match.myAmount !== null ? (
          <span className="font-mono text-[15px] font-semibold tabular-nums">
            {formatMoney(match.myAmount)}
            <span className="ml-0.5 text-muted-foreground">đ</span>
          </span>
        ) : null}
        <Badge variant={money.variant}>{money.label}</Badge>
      </span>
    </div>
  )
}
