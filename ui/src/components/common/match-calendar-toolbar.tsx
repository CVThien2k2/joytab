"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-media-query"
import { useNow } from "@/hooks/use-now"
import {
  CALENDAR_NAV_LABELS,
  CALENDAR_VIEWS,
  isCurrentPeriod,
  rangeTitle,
  shiftAnchor,
  type CalendarPeriod,
  type CalendarViewName,
} from "@/lib/match-range"

export type MatchCalendarToolbarProps = {
  anchor: Date
  /** Kỳ đang xem. Trên mobile luôn là `"agenda"` — xem `CalendarPeriod`. */
  view: CalendarPeriod
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
  const isMobile = useIsMobile()
  const labels = CALENDAR_NAV_LABELS[view]
  // Đang ở kỳ chứa hôm nay thì nút giữa hết việc. Vô hiệu hoá thay vì để bấm không-làm-gì:
  // nó thành luôn câu trả lời cho "tôi đang ở đâu" mà không cần thêm chữ nào trên thanh.
  const atCurrent = isCurrentPeriod(anchor, view, now)

  return (
    // Mobile xếp thành HAI hàng có chủ đích, không để `flex-wrap` tự bẻ: bốn cụm cộng lại ~408px
    // trên màn còn ~328px nên nó gãy thành ba hàng, mà hàng gãy thì cụm nào rơi xuống đâu là tuỳ
    // độ dài tiêu đề của kỳ đang xem — mỗi lần lật kỳ là bố cục nhảy một kiểu. Hai hàng cố định:
    // "đang ở đâu" ở trên, "xem kiểu gì / tạo mới" ở dưới.
    //
    // `md:contents` gỡ hai lớp bọc đó ra ở màn lớn, nên từ `md` trở lên đây vẫn đúng là một hàng
    // phẳng y như trước — không có bản bố cục thứ hai để trôi lệch.
    //
    // Ngưỡng `md` chứ không `sm`: nó phải trùng ngưỡng của `useIsMobile`, không thì dải
    // 640-767px sẽ có bố cục của màn lớn nhưng nội dung của mobile. `md` cũng là ranh giới mà
    // AppShell dùng để cất sidebar vào tấm trượt, nên cả khung đổi hình cùng một lúc.
    <div className="mb-3 flex shrink-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      {/* Ba nút cùng viền, dính vào nhau bằng `-ml-px` nên hai viền cạnh nhau chỉ còn một
          nét: cả cụm vẫn đọc ra là MỘT control, mà từng nút vẫn có viền riêng chứ không phải
          nút chìm. `focus-visible:relative z-10` để vòng focus không bị nút bên cạnh cắt mất
          một cạnh — nút sau nằm trên nút trước theo thứ tự DOM. */}
      <div className="flex min-w-0 items-center gap-2 md:contents">
        <div className="flex shrink-0 items-center">
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
          className="min-w-0 flex-1 truncate text-sm font-semibold capitalize"
          suppressHydrationWarning
        >
          {/* Bản ngắn trên mobile: "Thứ Bảy, 30 tháng 8, 2026" bị cắt đúng ở chỗ mang thông tin
            khi thanh chỉ còn hơn trăm pixel cho tiêu đề. */}
          {rangeTitle(anchor, view, isMobile)}
        </p>

        {loading ? <Spinner className="size-4 shrink-0 text-muted-foreground" /> : null}

        {/* Mobile: nút tạo lịch đứng luôn ở hàng này. Bỏ bộ chuyển đi rồi thì hàng thứ hai chỉ
          còn đúng một nút, mà một nút lẻ chiếm trọn một hàng thì vừa tốn 40px vừa trông như bị
          bỏ quên. Render ở MỘT trong hai chỗ tuỳ bề ngang, không phải hai bản cùng tồn tại rồi
          ẩn một cái — hai cái nút cùng nghĩa trong DOM là hai đích bấm cho cùng một việc. */}
        {isMobile ? actions : null}
      </div>

      {isMobile ? null : (
        <div className="flex items-center justify-between gap-2 md:contents">
          {/* Mobile KHÔNG có bộ chuyển: ở đó chỉ có một cách hiển thị — danh sách trận. Ba kiểu
            lịch lưới đều chia 7 cột nên không dùng được ở bề ngang đó, mà để chúng trong bộ
            chuyển là mời người ta bấm sang một kiểu xem đã vỡ. Hàng này khi đó chỉ còn nút tạo
            lịch, đẩy sang phải. */}
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
      )}
    </div>
  )
}
