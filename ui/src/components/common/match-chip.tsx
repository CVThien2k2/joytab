"use client"

import { Check, CircleCheck, CirclePlay, Clock } from "lucide-react"
import type { EventApi, EventDisplayInfo } from "@fullcalendar/react"
import { MatchHoverCardContent } from "@/components/common/match-hover-card"
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card"
import { useNow } from "@/hooks/use-now"
import { MATCH_ATTENDANCE_LABELS, matchAttendance } from "@/lib/match-attendance"
import { statusClass } from "@/lib/color"
import { formatTimeRange } from "@/lib/format"
import { MATCH_PHASE_LABELS, matchPhase, type MatchPhase } from "@/lib/match-phase"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types/match"

/**
 * Input: một event của FullCalendar.
 * Output: Trận nằm sau nó, hoặc `null` nếu event đó không phải một trận.
 *
 *         `selectMirror` và bóng mờ lúc kéo thả là event do THƯ VIỆN tự dựng: chúng chạy qua
 *         đúng `eventClass`/`eventContent` như event thật nhưng `extendedProps` rỗng. Đọc
 *         thẳng `.match.status` ở đó là ném TypeError và sập cả trang — đúng vào lúc người
 *         dùng vừa bấm một ô trống để tạo lịch.
 */
export function matchOf(event: EventApi): MatchSummary | null {
  return (event.extendedProps as { match?: MatchSummary }).match ?? null
}

/**
 * Icon của từng giai đoạn. Đi kèm chữ chứ không thay chữ: trên một badge 10px, icon là thứ mắt
 * bắt được trước khi đọc, còn chữ mới là thứ nói chính xác — bỏ chữ đi thì ba icon nhỏ xíu
 * thành ba câu đố.
 */
const PHASE_ICON: Record<MatchPhase, typeof Clock> = {
  upcoming: Clock,
  ongoing: CirclePlay,
  ended: CircleCheck,
}

export type MatchChipProps = {
  info: EventDisplayInfo
  organizationId: string
  /** Owner: chip nhấc lên được, nên con trỏ phải nói ra điều đó. */
  editable?: boolean
  onOpenDetail: (matchId: string) => void
}

/**
 * Input: thông tin render event của FullCalendar + tổ chức đang xem.
 * Output: Ruột một chip trên lịch, bọc trong thẻ hover.
 *
 *         Năm thứ, mỗi thứ trả lời một câu người ta hỏi khi đưa mắt qua lưới: khung giờ ("mấy
 *         giờ"), tên sân ("ở đâu"), nhãn giai đoạn ("buổi này còn ở phía trước hay đã xong"),
 *         dấu tích ("mình có trong đó không") và sĩ số ("còn chỗ không").
 *
 *         Hai thứ sau từng bị cố tình bỏ đi để chip khỏi chật, và đó là một quyết định sai:
 *         "mình đã đăng ký chưa" là câu HAY HỎI NHẤT khi mở lịch ra, mà bắt rê chuột vào từng
 *         chip mới trả lời được thì cả lưới không nói được gì về người đang xem. Chỗ cho chúng
 *         lấy được mà không đẩy hai thứ kia ngắn lại: dấu tích là một icon 12px đi liền khung
 *         giờ (khung giờ có bề rộng cố định), còn sĩ số nằm ở ĐẦU KIA của dòng nhãn giai đoạn —
 *         dòng đó vốn thừa chỗ vì nhãn chỉ chiếm nửa trái.
 *
 *         Riêng chip THẤP (`isShort`, một dòng) không có sĩ số: ở đó cả ba thứ đã xếp ngang
 *         nhau rồi, thêm nữa là tên sân cụt còn một chữ. Sĩ số vẫn nằm trong thẻ xem nhanh.
 *
 *         Nền chip nói trạng thái đăng ký của người xem (đặc/rỗng/xám) và do `eventClass` ở
 *         tầng lịch tô — xem `MATCH_ATTENDANCE_EVENT_CLASS`. Ở đây chỉ thêm phần chữ tương ứng,
 *         kể cả một nhãn `sr-only`: nền là thông tin, mà nền thì trình đọc màn hình không đọc.
 *
 *         Con trỏ nói ra thao tác: owner thấy `move` (nhấc lên được), người khác thấy `pointer`
 *         (bấm để mở). Không đổi nền khi rê: chip đã nằm
 *         trên nền `primary` đặc, phủ thêm một lớp nữa chỉ làm màu chip nhảy một nhịp trong khi
 *         thẻ xem nhanh sắp bung ra ngay bên cạnh mới là câu trả lời thật.
 *
 */
export function MatchChip({ info, organizationId, editable, onOpenDetail }: MatchChipProps) {
  const now = useNow()
  const match = matchOf(info.event)
  // Bóng mờ của thao tác quét chọn: để thư viện tự vẽ khối màu của nó, đừng nhét chữ vào —
  // nó đang nói "vùng bạn đang chọn", chứ chưa có trận nào để mô tả.
  if (!match) return null

  // Nhãn giai đoạn ngay trên chip: nhìn lưới là biết buổi nào chưa diễn ra, buổi nào đang
  // diễn ra, buổi nào đã kết thúc — không phải tự so giờ trên chip với giờ hiện tại, cũng
  // không phải rê vào từng cái. Nền ngày quá khứ chỉ nói được tới mức NGÀY: trong hôm nay vẫn
  // có buổi sáng đã kết thúc và buổi tối chưa diễn ra.
  //
  // Màu nhãn suy từ MÃ giai đoạn qua `statusClass` (cùng cách băm với màu avatar, chép từ hub)
  // nên ba trạng thái ra ba màu rõ rệt mà không ai phải gán tay từng cái.
  const phase = matchPhase(match, now)
  const attendance = matchAttendance(match)
  const PhaseIcon = PHASE_ICON[phase]
  const phaseBadge = (
    <span
      className={cn(
        "flex w-fit shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] leading-4 font-medium",
        statusClass(phase),
      )}
    >
      <PhaseIcon className="size-3 shrink-0" aria-hidden="true" />
      {MATCH_PHASE_LABELS[phase]}
    </span>
  )

  // Dấu tích đi LIỀN khung giờ chứ không đứng riêng: nó chỉ có ở trận đã đăng ký, mà một phần
  // tử lúc có lúc không nằm đầu dòng thì mỗi chip lại đẩy khung giờ lệch đi một đoạn khác nhau.
  const time = (
    <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums">
      {attendance === "joined" ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}
      {formatTimeRange(match.startAt, match.endAt)}
    </span>
  )

  const court = <span className="min-w-0 flex-1 truncate">{match.courtName}</span>

  // Sĩ số mờ hơn phần còn lại bằng `opacity` chứ không bằng một màu chữ: chip có ba kiểu nền
  // (đặc/rỗng/xám), mà một token màu cố định thì luôn có một nền làm nó chìm hẳn hoặc chói lên.
  const count = (
    <span className="shrink-0 text-[10px] leading-4 tabular-nums opacity-75">
      {match.playerCount}/{match.maxPlayers}
    </span>
  )

  // Chip cao thì xếp hai dòng, thấp thì một dòng. Xếp ngang cố định thì "19:00 - 21:00" ăn
  // mất nửa bề ngang của một cột trong lịch tuần, và tên sân cụt còn đúng một chữ.
  //
  // Nhãn giai đoạn ĐỨNG RIÊNG một dòng ở chip cao: nó là câu dài nhất trên chip, xếp cùng dòng
  // với khung giờ thì trong lịch tuần (cột rộng chừng 120px) một trong hai sẽ bị cắt. Ở chip
  // thấp thì nhãn đi trước tên sân, vì tên sân là thứ chấp nhận cụt được.
  const body = (
    <div
      className={cn(
        "flex h-full w-full max-w-md min-w-0 overflow-hidden text-xs",
        // Owner nhấc chip lên được nên con trỏ là `move`; người khác chỉ bấm để mở chi tiết.
        // Trận đã tới giờ vẫn để `move`: nó vẫn kéo được thật, chỉ là thả ra thì bật về kèm
        // toast — con trỏ nói về việc nhấc được hay không, không nói về việc có được phép dời.
        editable ? "cursor-move" : "cursor-pointer",
        info.isShort ? "items-center gap-1.5" : "flex-col justify-center gap-0.5",
      )}
    >
      <span className="sr-only">{MATCH_ATTENDANCE_LABELS[attendance]}.</span>
      {info.isShort ? (
        <>
          {time}
          {phaseBadge}
          {court}
        </>
      ) : (
        <>
          <span className="flex w-full min-w-0 items-center gap-1.5">
            {time}
            {court}
          </span>
          {/* Nhãn giai đoạn và sĩ số dạt về hai đầu: cả hai đều ngắn và có bề rộng gần như cố
              định, nên đẩy ra hai mép thì khoảng trống dồn vào giữa thay vì cắt mất một cái. */}
          <span className="flex w-full min-w-0 items-center justify-between gap-1.5">
            {phaseBadge}
            {count}
          </span>
        </>
      )}
    </div>
  )

  // Đang kéo hoặc đang là bóng mờ đi theo con trỏ: không bọc thẻ hover. Con trỏ lúc đó nằm
  // ngay trên chip, thẻ sẽ bung ra che đúng chỗ người ta đang ngắm để thả.
  if (info.isDragging || info.isMirror || info.isResizing) return body

  return (
    <HoverCard>
      {/* asChild vì Trigger mặc định dựng một <a>, mà chip đã nằm trong phần tử event do
          FullCalendar dựng — lồng thêm một link nữa là HTML sai và là hai đích bấm chồng nhau. */}
      <HoverCardTrigger asChild>{body}</HoverCardTrigger>
      <MatchHoverCardContent
        match={match}
        organizationId={organizationId}
        onOpenDetail={onOpenDetail}
      />
    </HoverCard>
  )
}
