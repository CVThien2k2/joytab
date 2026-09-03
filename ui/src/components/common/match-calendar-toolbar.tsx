"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNow } from "@/hooks/use-now"
import {
  CALENDAR_NAV_LABELS,
  CALENDAR_VIEWS,
  isCurrentPeriod,
  rangeTitle,
  shiftAnchor,
  type CalendarViewName,
} from "@/lib/match-range"

export type MatchCalendarToolbarProps = {
  anchor: Date
  view: CalendarViewName
  loading?: boolean
  onAnchorChange: (anchor: Date) => void
  onViewChange: (view: CalendarViewName) => void
  /** Nút của trang (tạo lịch). */
  actions?: React.ReactNode
}

/**
 * Input: kỳ đang xem + các lệnh đổi kỳ.
 * Output: Thanh lọc ngày của bộ lịch.
 *
 *         Nằm ở TRANG chứ không nằm trong bộ lịch, và không đụng tới `CalendarController`:
 *         trang giữ mốc neo, bộ lịch nhận nó qua prop `date` — tức bộ lịch là thành phần ĐƯỢC
 *         ĐIỀU KHIỂN. Nhờ vậy khoảng gửi lên BE và kỳ đang vẽ luôn là cùng một giá trị, chứ
 *         không phải hai bản sao phải giữ cho khớp nhau.
 *
 *         Ba nút đổi kỳ dính liền thành MỘT cụm, xếp theo đúng trục thời gian: lùi ‹ — hiện tại —
 *         tiến ›. "Hiện tại" ở giữa vì nó là mốc gốc mà hai chiều kia đi ra từ đó, và vì đặt
 *         nó ở giữa thì cả ba đích đến đều nằm trong một quãng chuột ngắn.
 *
 *         Cụm này có bề rộng CỐ ĐỊNH theo kiểu xem, tách khỏi tiêu đề: tiêu đề dài ngắn tuỳ
 *         kỳ ("Tháng 8, 2026" so với "Thứ Bảy, 30 tháng 8, 2026"), nên nếu kẹp hai mũi vào hai
 *         đầu tiêu đề thì mỗi lần bấm là mũi bên phải nhảy đi một đoạn — lật vài kỳ liên tiếp
 *         sẽ bấm trượt. Nút không chạy thì lật kỳ chỉ cần ngắm một lần.
 */
export function MatchCalendarToolbar({
  anchor,
  view,
  loading,
  onAnchorChange,
  onViewChange,
  actions,
}: MatchCalendarToolbarProps) {
  const now = useNow()
  const labels = CALENDAR_NAV_LABELS[view]
  // Đang ở kỳ chứa hôm nay thì nút giữa hết việc. Vô hiệu hoá thay vì để bấm không-làm-gì:
  // nó thành luôn câu trả lời cho "tôi đang ở đâu" mà không cần thêm chữ nào trên thanh.
  const atCurrent = isCurrentPeriod(anchor, view, now)

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      {/* Ba nút cùng viền, dính vào nhau bằng `-ml-px` nên hai viền cạnh nhau chỉ còn một
          nét: cả cụm vẫn đọc ra là MỘT control, mà từng nút vẫn có viền riêng chứ không phải
          nút chìm. `focus-visible:relative z-10` để vòng focus không bị nút bên cạnh cắt mất
          một cạnh — nút sau nằm trên nút trước theo thứ tự DOM. */}
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-r-none focus-visible:relative focus-visible:z-10"
              aria-label={labels.prev}
              onClick={() => onAnchorChange(shiftAnchor(anchor, view, -1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{labels.prev}</TooltipContent>
        </Tooltip>

        <Button
          type="button"
          variant="outline"
          className="-ml-px min-w-22 rounded-none focus-visible:relative focus-visible:z-10"
          disabled={atCurrent}
          onClick={() => onAnchorChange(new Date())}
        >
          {labels.current}
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="-ml-px rounded-l-none focus-visible:relative focus-visible:z-10"
              aria-label={labels.next}
              onClick={() => onAnchorChange(shiftAnchor(anchor, view, 1))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{labels.next}</TooltipContent>
        </Tooltip>
      </div>

      {/* Tiêu đề suy ra từ "bây giờ" của MÁY ĐANG XEM, nên server và client dựng ra hai chuỗi
          khác nhau (khác múi giờ là khác cả tuần). Đây đúng là trường hợp React dựng sẵn
          `suppressHydrationWarning`: chênh lệch là có thật và đúng, không phải lỗi cần sửa. */}
      <p
        className="min-w-0 flex-1 truncate text-base font-semibold capitalize"
        suppressHydrationWarning
      >
        {rangeTitle(anchor, view)}
      </p>

      {loading ? <Spinner className="size-4 text-muted-foreground" /> : null}

      <Tabs value={view} onValueChange={(next) => onViewChange(next as CalendarViewName)}>
        <TabsList>
          {CALENDAR_VIEWS.map((option) => (
            <TabsTrigger key={option.type} value={option.type}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {actions}
    </div>
  )
}
