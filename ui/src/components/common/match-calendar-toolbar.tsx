"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CALENDAR_VIEWS, rangeTitle, shiftAnchor, type CalendarViewName } from "@/lib/match-range"

export type MatchCalendarToolbarProps = {
  anchor: Date
  view: CalendarViewName
  loading?: boolean
  onAnchorChange: (anchor: Date) => void
  onViewChange: (view: CalendarViewName) => void
  /** Nút của trang (đổi cách xem, tạo lịch). */
  actions?: React.ReactNode
}

/**
 * Input: kỳ đang xem + các lệnh đổi kỳ.
 * Output: Thanh lọc ngày, dùng chung cho cả bộ lịch lẫn danh sách.
 *
 *         Nằm ở TRANG chứ không nằm trong bộ lịch, và không đụng tới `CalendarController`:
 *         chế độ danh sách không có bộ lịch nào để điều khiển, mà một thanh lọc chỉ chạy được
 *         ở một trong hai chế độ thì không phải là thanh lọc của trang. Trang giữ mốc neo, bộ
 *         lịch nhận nó qua prop `date` — tức bộ lịch là thành phần ĐƯỢC ĐIỀU KHIỂN.
 *
 *         Bộ ba kiểu xem dùng Tabs thay vì ba nút rời, theo đúng component mẫu trong registry
 *         shadcn của FullCalendar: chúng loại trừ nhau, và Tabs nói ra điều đó bằng cả hình
 *         dạng lẫn vai trò cho trình đọc màn hình.
 */
export function MatchCalendarToolbar({
  anchor,
  view,
  loading,
  onAnchorChange,
  onViewChange,
  actions,
}: MatchCalendarToolbarProps) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Kỳ trước"
          onClick={() => onAnchorChange(shiftAnchor(anchor, view, -1))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Kỳ sau"
          onClick={() => onAnchorChange(shiftAnchor(anchor, view, 1))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" onClick={() => onAnchorChange(new Date())}>
          Hôm nay
        </Button>
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
