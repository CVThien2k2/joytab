"use client"

import { CircleCheck, CirclePlay, Clock } from "lucide-react"
import type { EventApi, EventDisplayInfo } from "@fullcalendar/react"
import { MatchHoverCardContent } from "@/components/common/match-hover-card"
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card"
import { useNow } from "@/hooks/use-now"
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
 *         Ba thứ, mỗi thứ trả lời một câu người ta hỏi khi đưa mắt qua lưới: khung giờ ("mấy
 *         giờ"), tên sân ("ở đâu"), và nhãn giai đoạn ("buổi này còn ở phía trước hay đã xong").
 *
 *         KHÔNG có sĩ số và không có dấu tích "tôi đã đăng ký": trên một ô cao chưa tới 60px,
 *         mỗi thứ thêm vào là một thứ nữa đẩy hai thứ kia ngắn lại. Cả hai đều nằm trong thẻ
 *         xem nhanh và trang chi tiết, cách một cú rê chuột.
 *
 *         Con trỏ nói ra thao tác: owner thấy `move` (nhấc lên được), người khác thấy `pointer`
 *         (bấm để mở). Không đổi nền khi rê: chip đã nằm
 *         trên nền `primary` đặc, phủ thêm một lớp nữa chỉ làm màu chip nhảy một nhịp trong khi
 *         thẻ xem nhanh sắp bung ra ngay bên cạnh mới là câu trả lời thật.
 *
 *         Nền và chữ do `eventClass` ở tầng lịch lo (primary đặc, như nút của app). Ở đây chỉ
 *         xếp chữ.
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

  const time = (
    <span className="shrink-0 font-semibold tabular-nums">
      {formatTimeRange(match.startAt, match.endAt)}
    </span>
  )

  const court = <span className="min-w-0 flex-1 truncate">{match.courtName}</span>

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
          {phaseBadge}
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
