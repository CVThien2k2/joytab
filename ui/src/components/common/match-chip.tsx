"use client"

import type { EventApi, EventDisplayInfo } from "@fullcalendar/react"
import { MatchHoverCardContent } from "@/components/common/match-hover-card"
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card"
import { formatTimeRange } from "@/lib/format"
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

export type MatchChipProps = {
  info: EventDisplayInfo
  organizationId: string
  onOpenDetail: (matchId: string) => void
}

/**
 * Input: thông tin render event của FullCalendar + tổ chức đang xem.
 * Output: Ruột một chip trên lịch, bọc trong thẻ hover.
 *
 *         Chỉ hai thứ: khung giờ và tên sân. Sĩ số, mức lấp đầy, trạng thái — tất cả đã có
 *         trong thẻ hover và trang chi tiết. Trên lưới, một ô cao chưa tới 40px mà nhét bốn
 *         thông tin thì không thông tin nào đọc được, còn hai thứ này đủ để nhận ra buổi nào
 *         là buổi nào.
 *
 *         Nền và chữ do `eventClass` ở tầng lịch lo (primary đặc, như nút của app). Ở đây chỉ
 *         xếp chữ.
 */
export function MatchChip({ info, organizationId, onOpenDetail }: MatchChipProps) {
  const match = matchOf(info.event)
  // Bóng mờ của thao tác quét chọn: để thư viện tự vẽ khối màu của nó, đừng nhét chữ vào —
  // nó đang nói "vùng bạn đang chọn", chứ chưa có trận nào để mô tả.
  if (!match) return null

  // Chip cao thì xếp hai dòng, thấp thì một dòng. Xếp ngang cố định thì "19:00 - 21:00" ăn
  // mất nửa bề ngang của một cột trong lịch tuần, và tên sân cụt còn đúng một chữ.
  const body = (
    <div
      className={cn(
        "flex h-full w-full max-w-md min-w-0 overflow-hidden text-xs",
        info.isShort ? "items-center gap-1.5" : "flex-col justify-center gap-0.5",
      )}
    >
      <span className="shrink-0 font-semibold tabular-nums">
        {formatTimeRange(match.startAt, match.endAt)}
      </span>
      <span className="min-w-0 flex-1 truncate">{match.courtName}</span>
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
