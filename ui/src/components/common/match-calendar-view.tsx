"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import type { EventContentArg, EventDropArg } from "@fullcalendar/core"
import viLocale from "@fullcalendar/core/locales/vi"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import timeGridPlugin from "@fullcalendar/timegrid"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types/match"

/** Khoảng ngày lịch đang hiển thị — dạng ISO, gửi thẳng lên BE. */
export type CalendarRange = { from: string; to: string }

export type MatchCalendarProps = {
  matches: MatchSummary[]
  loading?: boolean
  /** Owner mới được kéo thả và bấm vào ô trống để tạo lịch. */
  editable?: boolean
  onRangeChange: (range: CalendarRange) => void
  onSelectMatch: (matchId: string) => void
  onCreateAt?: (params: { start: Date; end: Date | null; allDay: boolean }) => void
  /**
   * Kéo thả xong. `revert` trả chip về chỗ cũ — PHẢI gọi khi server từ chối, nếu không màn
   * hình đang hiển thị một lịch mà server không có.
   */
  onMove?: (params: { matchId: string; startAt: string; endAt: string; revert: () => void }) => void
}

/** Kiểu view của FullCalendar mà màn này dùng. */
type ViewName = "dayGridMonth" | "timeGridWeek"

/**
 * Màu chip theo trạng thái. Trận đã huỷ gạch ngang chứ không ẩn: "hôm đó có trận nhưng đã
 * huỷ" là thông tin, còn ô trống thì không nói gì.
 */
function chipClass(match: MatchSummary): string {
  if (match.status === "canceled") {
    return "border-border bg-muted text-muted-foreground line-through opacity-70"
  }
  if (match.status === "settled") {
    return "border-border bg-muted text-foreground"
  }
  if (match.voted) {
    return "border-primary/40 bg-primary/15 text-foreground"
  }
  return "border-border bg-card text-foreground"
}

/**
 * Input: danh sách trận + các callback điều khiển.
 * Output: Bộ lịch tháng/tuần. Dùng chung cho lịch cá nhân (chỉ đọc) và lịch tổ chức (owner
 *         kéo thả được) — khác nhau đúng ở props.
 *
 *         Toolbar mặc định của FullCalendar bị TẮT và dựng lại bằng Button của app: toolbar
 *         của thư viện không có cách nào trông giống phần còn lại của giao diện, mà nó lại
 *         nằm ngay đầu trang.
 *
 *         Màu sắc đi qua bộ biến `--fc-*` khai trong globals.css, không ghi đè class của thư
 *         viện — xem chú thích ở đó.
 */
export default function MatchCalendarView({
  matches,
  loading,
  editable = false,
  onRangeChange,
  onSelectMatch,
  onCreateAt,
  onMove,
}: MatchCalendarProps) {
  const calendarRef = useRef<FullCalendar | null>(null)
  const [title, setTitle] = useState("")
  const [view, setView] = useState<ViewName>("dayGridMonth")

  const events = useMemo(
    () =>
      matches.map((match) => ({
        id: match.id,
        title: match.courtName,
        start: match.startAt,
        end: match.endAt,
        // Trận đã chốt tiền hoặc đã huỷ thì kéo đổi giờ là vô nghĩa — khoá ngay trên event
        // chứ không khoá cả lịch, vì các trận khác vẫn kéo được.
        editable: editable && match.status === "open",
        extendedProps: { match },
      })),
    [matches, editable],
  )

  const api = () => calendarRef.current?.getApi()

  const renderEvent = useCallback((arg: EventContentArg) => {
    const match = arg.event.extendedProps.match as MatchSummary
    const start = match.startAt.slice(11, 16)

    return (
      <div
        className={cn(
          "flex w-full items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-xs",
          chipClass(match),
        )}
      >
        <span className="shrink-0 font-semibold tabular-nums">{start}</span>
        <span className="min-w-0 flex-1 truncate">{match.courtName}</span>
        <span className="shrink-0 tabular-nums opacity-70">
          {match.playerCount}/{match.maxPlayers}
        </span>
      </div>
    )
  }, [])

  const handleMove = useCallback(
    (arg: EventDropArg | { event: EventDropArg["event"]; revert: () => void }) => {
      const start = arg.event.start
      const end = arg.event.end
      if (!start || !end) {
        arg.revert()
        return
      }
      onMove?.({
        matchId: arg.event.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        revert: arg.revert,
      })
    },
    [onMove],
  )

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Kỳ trước"
            onClick={() => api()?.prev()}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Kỳ sau"
            onClick={() => api()?.next()}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" onClick={() => api()?.today()}>
            Hôm nay
          </Button>
        </div>

        <p className="min-w-0 flex-1 truncate text-base font-semibold capitalize">{title}</p>

        {loading ? <Spinner className="size-4 text-muted-foreground" /> : null}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={view === "dayGridMonth" ? "default" : "outline"}
            onClick={() => api()?.changeView("dayGridMonth")}
          >
            Tháng
          </Button>
          <Button
            type="button"
            variant={view === "timeGridWeek" ? "default" : "outline"}
            onClick={() => api()?.changeView("timeGridWeek")}
          >
            Tuần
          </Button>
        </div>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={viLocale}
        // Toolbar tự dựng ở trên — xem chú thích đầu file.
        headerToolbar={false}
        height="auto"
        firstDay={1}
        // Việt Nam không có giờ mùa hè nên không phải lo giờ nhảy; giữ múi giờ máy người dùng.
        events={events}
        eventContent={renderEvent}
        dayMaxEvents={3}
        moreLinkText={(count) => `+${count} trận`}
        nowIndicator
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        allDaySlot={false}
        expandRows
        selectable={editable && Boolean(onCreateAt)}
        selectMirror
        eventClick={(arg) => onSelectMatch(arg.event.id)}
        select={(arg) => onCreateAt?.({ start: arg.start, end: arg.end, allDay: arg.allDay })}
        eventDrop={handleMove}
        eventResize={handleMove}
        datesSet={(arg) => {
          setTitle(arg.view.title)
          setView(arg.view.type as ViewName)
          onRangeChange({ from: arg.start.toISOString(), to: arg.end.toISOString() })
        }}
      />
    </div>
  )
}
