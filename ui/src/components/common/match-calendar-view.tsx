"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, useCalendarController } from "@fullcalendar/react"
import type {
  DateSelectInfo,
  DayCellInfo,
  DayLaneInfo,
  EventDisplayInfo,
  EventDropInfo,
  EventResizeDoneInfo,
} from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import interactionPlugin from "@fullcalendar/react/interaction"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import breezyThemePlugin from "@fullcalendar/react/themes/breezy"
import viLocale from "@fullcalendar/react/locales/vi"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { MatchChip, matchOf } from "@/components/common/match-chip"
import { useNow } from "@/hooks/use-now"
import { matchPhase } from "@/lib/match-phase"
import type { CalendarViewName } from "@/lib/match-range"
import type { MatchSummary } from "@/types/match"

import "@fullcalendar/react/skeleton.css"
import "@fullcalendar/react/themes/breezy/theme.css"

/** Một lần kéo thả đã xong, chờ người dùng xác nhận lại giờ. */
export type MatchMoveRequest = {
  match: MatchSummary
  start: Date
  end: Date
  /** Trả chip về chỗ cũ. PHẢI gọi khi người dùng huỷ hoặc server từ chối. */
  revert: () => void
}

export type MatchCalendarProps = {
  matches: MatchSummary[]
  organizationId: string
  /** Kỳ đang xem. Bộ lịch ĐƯỢC ĐIỀU KHIỂN — trang mới là nơi giữ hai giá trị này. */
  anchor: Date
  view: CalendarViewName
  /**
   * Owner mới được kéo thả và bấm vào ô trống để tạo lịch. Cờ này chỉ nói về QUYỀN; còn trận
   * nào dời được thì `handleMove` xét lúc thả — mọi chip đều nhấc lên được.
   */
  editable?: boolean
  onSelectMatch: (matchId: string) => void
  onCreateAt?: (params: { start: Date; end: Date }) => void
  onMove?: (request: MatchMoveRequest) => void
}

const MINUTE = 60_000
/**
 * Một ô = một TIẾNG, không phải 30 phút như mặc định của v7.
 *
 * Không buổi đá nào ngắn hơn hai tiếng, nên lưới nửa tiếng chỉ làm lịch thêm dày gấp đôi mà
 * không ai dùng tới độ chính xác đó — và kéo thả thì phải ngắm kỹ hơn để trúng ô.
 */
const SLOT_DURATION = "01:00:00"
/** Bấm một phát trong lịch tuần/ngày chọn đúng một ô, tức là ngần này. */
const CLICK_SLOT_MS = 60 * MINUTE
/** Một buổi đá mặc định 2 tiếng — dùng khi người dùng BẤM một phát chứ không quét chọn. */
const DEFAULT_DURATION_MS = 2 * 60 * MINUTE
/** Giờ mặc định khi bấm một Ô NGÀY ở lịch tháng — ở đó không có thông tin giờ nào cả. */
const DEFAULT_START_HOUR = 19

function startOfDay(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Input: vùng người dùng vừa chọn trên lịch + mốc "bây giờ".
 * Output: Khoảng giờ sẽ điền sẵn vào form tạo lịch.
 *
 *         Ba trường hợp, và cả ba đều phải ra một khoảng giờ CỤ THỂ để form không phải tự
 *         đoán lần nữa:
 *
 *         - Quét chọn một khoảng trong lịch tuần/ngày: dùng đúng khoảng đó.
 *         - Bấm một phát vào lịch tuần/ngày: trả về đúng một ô, tức một tiếng — vẫn ngắn hơn
 *           mọi buổi đá có thật, nên nới thành hai tiếng.
 *         - Bấm một ô ngày ở lịch tháng: không có giờ nào để lấy, rơi về 19h. Nếu hôm nay đã
 *           quá 19h thì lấy giờ tròn kế tiếp, vì bấm vào ô HÔM NAY là ý muốn tạo một
 *           trận sắp tới chứ không phải một trận đã lỡ.
 */
function plannedRange(info: DateSelectInfo, now: number): { start: Date; end: Date } {
  if (!info.allDay) {
    const start = info.start
    const end =
      info.end.getTime() - start.getTime() <= CLICK_SLOT_MS
        ? new Date(start.getTime() + DEFAULT_DURATION_MS)
        : info.end
    return { start, end }
  }

  const start = new Date(info.start)
  start.setHours(DEFAULT_START_HOUR, 0, 0, 0)
  if (startOfDay(start.getTime()) === startOfDay(now) && start.getTime() < now) {
    start.setTime(Math.ceil(now / CLICK_SLOT_MS) * CLICK_SLOT_MS)
  }
  return { start, end: new Date(start.getTime() + DEFAULT_DURATION_MS) }
}

/**
 * Input: danh sách trận + kỳ đang xem + các callback điều khiển.
 * Output: Chỉ phần LƯỚI của bộ lịch. Thanh lọc ngày nằm ở trang (MatchCalendarToolbar), vì
 *         nó phải lái được cả chế độ danh sách.
 *
 *         Không có viền, không có vỏ thẻ: `borderless` là option sẵn có của v7 chứ không phải
 *         mẹo CSS. Bỏ viền để lưới và danh sách nằm trên cùng một nền — hai chế độ của cùng
 *         một trang mà một bên có khung một bên không thì mỗi lần đổi là một lần giao diện nhảy.
 *
 *         Toàn bộ phần nhìn đi qua hai cửa chính thức của v7: bộ biến của theme và các hook
 *         `*Class`. v7 sinh class băm nên không còn cách nào bám vào cấu trúc bên trong nó —
 *         xem chú thích ở globals.css.
 */
export default function MatchCalendarView({
  matches,
  organizationId,
  anchor,
  view,
  editable = false,
  onSelectMatch,
  onCreateAt,
  onMove,
}: MatchCalendarProps) {
  const controller = useCalendarController()
  const now = useNow()
  const { resolvedTheme } = useTheme()
  // Kỳ lúc MOUNT. `initialDate`/`initialView` chỉ đọc một lần, nên chốt lại để lần render đầu
  // không lệch nếu trang đã đổi kỳ trước lúc chunk của bộ lịch về. `useState` chứ không
  // `useRef`: đọc ref trong thân render là thứ React Compiler chặn.
  const [initial] = useState(() => ({ anchor, view }))

  // v7 KHÔNG có option `date`/`view` — chỉ có `initial*`, đọc đúng một lần. Nên "được điều
  // khiển" ở đây làm bằng cách đẩy: trang đổi kỳ thì gọi thẳng vào controller. Trang vẫn là
  // nguồn sự thật duy nhất; bộ lịch chỉ đi theo.
  useEffect(() => {
    controller.gotoDate(anchor)
  }, [controller, anchor])

  useEffect(() => {
    controller.changeView(view)
  }, [controller, view])

  const events = useMemo(
    () =>
      matches.map((match) => ({
        id: match.id,
        title: match.courtName,
        start: match.startAt,
        end: match.endAt,
        extendedProps: { match },
      })),
    [matches],
  )

  // Mở lịch ra là thấy quanh giờ hiện tại, không phải 6h sáng. Trừ một tiếng để vẫn còn thấy
  // trận vừa bắt đầu, thứ hay được hỏi tới nhất.
  const scrollTime = useMemo(() => {
    const hour = Math.max(0, new Date(now).getHours() - 1)
    return `${`${hour}`.padStart(2, "0")}:00:00`
  }, [now])

  const renderEvent = useCallback(
    (info: EventDisplayInfo) => (
      <MatchChip
        info={info}
        organizationId={organizationId}
        editable={editable}
        onOpenDetail={onSelectMatch}
      />
    ),
    [organizationId, editable, onSelectMatch],
  )

  const handleSelect = useCallback(
    (info: DateSelectInfo) => {
      if (!onCreateAt) return
      const range = plannedRange(info, now)

      // Chặn ở đây vì BE cấm TẠO trận trong quá khứ (nhưng vẫn cho DỜI về quá khứ — owner
      // nhập bù một buổi đã đá). Nói ra bằng toast thay vì lặng lẽ không mở dialog: bấm mà
      // không có gì xảy ra thì người ta bấm lại lần nữa.
      if (range.start.getTime() < now) {
        toast.warning("Không tạo được lịch ở thời điểm đã qua")
        return
      }

      onCreateAt(range)
    },
    [onCreateAt, now],
  )

  /**
   * Thả tay sau khi kéo (hoặc giãn) một chip.
   *
   * MỌI chip đều kéo được, kể cả trận đã tới giờ hay đã chốt tiền — rồi mới từ chối lúc thả.
   * Cố ý: một chip không nhấc lên được thì người dùng không biết là "không được phép" hay là
   * "mình bấm chưa đúng chỗ", và cả lưới thành nửa kéo được nửa không. Kéo được rồi bật về kèm
   * một câu giải thích thì câu trả lời rõ ràng và chỉ mất một cú kéo.
   *
   * `match` đọc từ `extendedProps` nên vẫn là giờ GỐC của trận, không phải giờ vừa kéo tới —
   * đúng thứ cần để xét trận đã tới giờ hay chưa.
   */
  const handleMove = useCallback(
    (info: EventDropInfo | EventResizeDoneInfo) => {
      const start = info.event.start
      const end = info.event.end
      const match = matchOf(info.event)
      if (!start || !end || !match || !onMove) {
        info.revert()
        return
      }

      // Cùng luật với BE (MATCH_011 / MATCH_015), nói ra ở đây để không phải đi một vòng
      // request chỉ để nhận về đúng câu này.
      if (match.status === "settled") {
        toast.warning("Trận đã chốt tiền, không dời được nữa")
        info.revert()
        return
      }
      if (matchPhase(match, now) !== "upcoming") {
        toast.warning("Trận đã tới giờ, không dời được nữa")
        info.revert()
        return
      }

      onMove({ match, start, end, revert: info.revert })
    },
    [onMove, now],
  )

  // Ngày đã qua: mờ đi. Chỉ tính theo NGÀY chứ không theo giờ — trong lịch tuần, một cột là
  // một ngày, không có cách nào làm mờ nửa trên của cột mà lưới vẫn còn đọc được.
  const pastClass = useCallback(
    (info: DayCellInfo | DayLaneInfo) =>
      info.date.getTime() < startOfDay(now) ? "match-day-past" : null,
    [now],
  )

  return (
    // `[&>*]` nhắm đúng phần tử gốc mà FullCalendar dựng. Cần nó vì v7 gán `height: 100%`
    // inline lên gốc, mà phần trăm không giải được khi cha là block lấy chiều cao từ flex —
    // kết quả là lịch cao 0px và biến mất. Cho nó co giãn theo flex thì chiều cao là số thật,
    // không còn phụ thuộc chuỗi phần trăm nào.
    <div className="flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1">
      <Calendar
        controller={controller}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, breezyThemePlugin]}
        initialDate={initial.anchor}
        initialView={initial.view}
        locale={viLocale}
        colorScheme={resolvedTheme}
        height="100%"
        // Bỏ hết viền lưới: option sẵn có của v7, không phải mẹo CSS. Xem chú thích đầu file.
        borderless
        firstDay={1}
        events={events}
        // Cả ba view đều vẽ chip đặc thay vì kiểu "chấm + chữ" mặc định của lịch tháng: chip
        // đọc được cả giờ lẫn tên sân, còn chấm thì chỉ nói "có gì đó ở đây".
        eventDisplay="block"
        eventContent={renderEvent}
        // Chip tô đặc bằng primary, đúng như nút của app — MỌI chip cùng màu, giai đoạn nói bằng
        // cái nhãn bên trong chứ không bằng màu nền. Dùng `!` vì theme tô nền event bằng một lớp
        // pha nhạt từ `--fc-event-color`, mà đây là chuyện của app chứ không phải của theme.
        eventClass="bg-primary! text-primary-foreground! border-primary!"
        dayCellClass={pastClass}
        dayLaneClass={pastClass}
        // Việt Nam không có giờ mùa hè nên không phải lo giờ nhảy; giữ múi giờ máy người dùng.
        slotDuration={SLOT_DURATION}
        slotMinTime="06:00:00"
        slotMaxTime="24:00:00"
        scrollTime={scrollTime}
        allDaySlot={false}
        expandRows
        dayMaxEvents={3}
        moreLinkText={(count) => `+${count} trận`}
        // Bật kéo thả ở TẦNG LỊCH, không gắn `editable` lên từng event nữa: mọi chip nhấc lên
        // được như nhau, việc từ chối là của `handleMove`.
        editable={editable}
        selectable={editable && Boolean(onCreateAt)}
        selectMirror
        // Một tổ chức không đá hai buổi cùng lúc (BE ném MATCH_014). Chặn ngay trên lưới thì
        // người ta biết trước khi thả tay, thay vì thả xong mới ăn một toast lỗi.
        //
        // `selectOverlap` chỉ tắt ở lịch tuần/ngày: ở đó vùng quét chọn đúng bằng khoảng giờ
        // sẽ tạo. Lịch THÁNG thì một cú bấm là chọn cả ngày, mà cả ngày thì luôn giao với trận
        // 19h của ngày đó — tắt ở đó là cấm luôn việc thêm buổi sáng vào một ngày đã có buổi
        // tối. Trận đã huỷ không chiếm giờ, và chúng cũng không có mặt trên lưới.
        selectOverlap={view === "dayGridMonth"}
        eventOverlap={false}
        eventClick={(info) => onSelectMatch(info.event.id)}
        select={handleSelect}
        eventDrop={handleMove}
        eventResize={handleMove}
      />
    </div>
  )
}
