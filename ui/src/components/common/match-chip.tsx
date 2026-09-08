"use client"

import { useState } from "react"
import { Check, Lock, Plus } from "lucide-react"
import type { EventApi, EventDisplayInfo } from "@fullcalendar/react"
import { MatchHoverCardContent } from "@/components/common/match-hover-card"
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card"
import { useNow } from "@/hooks/use-now"
import { MATCH_ATTENDANCE_LABELS, matchAttendance } from "@/lib/match-attendance"
import { formatTimeRange } from "@/lib/format"
import { MATCH_PHASE_LABELS, matchPhase } from "@/lib/match-phase"
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
  /** Owner: chip nhấc lên được, nên con trỏ phải nói ra điều đó. */
  editable?: boolean
  onOpenDetail: (matchId: string) => void
  /** Owner: sửa / huỷ ngay trong thẻ xem nhanh. Xem `MatchSummaryPanelProps`. */
  onEdit?: (match: MatchSummary) => void
  onCancel?: (match: MatchSummary) => void
}

/**
 * Input: thông tin render event của FullCalendar + tổ chức đang xem.
 * Output: Ruột một chip trên lịch, bọc trong thẻ hover.
 *
 *         Ba thứ in ra chữ: khung giờ ("mấy giờ"), tên sân ("ở đâu") và sĩ số ("còn chỗ
 *         không"). Hai câu còn lại trả lời bằng chính hình dạng của chip, không tốn dòng nào:
 *         nền nói giai đoạn ("buổi này còn ở phía trước hay đã xong"), viền và dấu tích nói
 *         "mình có trong đó không".
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
 *         Nền và viền chip do `eventClass` ở tầng lịch tô — xem `MATCH_PHASE_EVENT_CLASS` và
 *         `MATCH_ATTENDANCE_EVENT_CLASS`. Ở đây chỉ thêm phần chữ tương ứng, kể cả một nhãn
 *         `sr-only`: nền và viền là thông tin, mà cả hai thì trình đọc màn hình không đọc.
 *
 *         Con trỏ nói ra thao tác: owner thấy `move` (nhấc lên được), người khác thấy `pointer`
 *         (bấm để mở thẻ xem nhanh). Không đổi nền khi rê: chip đã nằm
 *         trên nền `primary` đặc, phủ thêm một lớp nữa chỉ làm màu chip nhảy một nhịp trong khi
 *         thẻ xem nhanh sắp bung ra ngay bên cạnh mới là câu trả lời thật.
 *
 */
export function MatchChip({
  info,
  organizationId,
  editable,
  onOpenDetail,
  onEdit,
  onCancel,
}: MatchChipProps) {
  const now = useNow()
  // Thẻ xem nhanh được ĐIỀU KHIỂN chứ không để Radix tự lo: rê chuột vẫn mở nó như cũ (Radix
  // gọi `onOpenChange`), nhưng BẤM cũng phải mở được. Không có nhánh bấm thì trên thiết bị cảm
  // ứng — nơi không có "rê" — chip là một khối chạm vào không ra gì.
  const [cardOpen, setCardOpen] = useState(false)
  const match = matchOf(info.event)
  // Bóng mờ của thao tác quét chọn: để thư viện tự vẽ khối màu của nó, đừng nhét chữ vào —
  // nó đang nói "vùng bạn đang chọn", chứ chưa có trận nào để mô tả.
  if (!match) return null

  // Giai đoạn KHÔNG có phần tử riêng nào trên chip: nó là màu nền của chính chip, do `eventClass`
  // ở tầng lịch tô (xem `MATCH_PHASE_EVENT_CLASS`). Trước đây nó là một nhãn chữ ăn gần trọn một
  // dòng, rồi là một chấm màu — cả hai đều tốn chỗ để nói lại thứ mà cái nền đã nói được. Nghĩa
  // của màu nằm ở chú giải dưới lịch, nói một lần cho cả lưới.
  const phase = matchPhase(match, now)
  const attendance = matchAttendance(match)

  // Cụm nổi ở góc TRÊN PHẢI, nằm ngoài mép chip: sĩ số rồi tới huy hiệu trạng thái. Port
  // nguyên vị trí của bản thiết kế (`top:-9px; right:-2px`) — nhô ra ngoài thì hai thứ này
  // không tranh chỗ với chữ bên trong, mà chip trong lịch tuần chỉ rộng chừng 120px.
  //
  // `ring-2 ring-card` vẽ một vòng cùng màu nền lịch quanh mỗi mảnh, để cụm này tách khỏi chip
  // phía trên thay vì dính vào nó. Phần tử event được mở `overflow: visible` ở `.match-chip`
  // (globals.css) — thiếu dòng đó thì cả cụm biến mất chứ không phải bị xén.
  //
  // Huy hiệu nói MỘT trong ba chuyện, theo đúng thứ tự ưu tiên của bản thiết kế: đã đăng ký
  // (dấu tích, tô đặc), không đăng ký được nữa (ổ khoá), hoặc còn đăng ký được (dấu cộng). Dấu
  // cộng là một lời mời — nó nói "chỗ này còn vào được", thứ mà một ô trống không nói được.
  const joined = attendance === "joined"
  const BadgeIcon = joined ? Check : match.voteClosedReason !== null ? Lock : Plus
  const floatCluster = (
    <span className="absolute -top-[9px] -right-0.5 flex items-center gap-1">
      <span className="flex h-[18px] shrink-0 items-center rounded-full border bg-card px-[7px] text-[10.5px] font-bold text-muted-foreground tabular-nums shadow-xs ring-2 ring-card">
        {match.playerCount}/{match.maxPlayers}
      </span>
      <span
        className={cn(
          "grid size-[18px] shrink-0 place-items-center rounded-full ring-2 ring-card",
          joined ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground",
        )}
      >
        <BadgeIcon className="size-2.5" strokeWidth={3} aria-hidden="true" />
      </span>
    </span>
  )

  // Hai dòng chữ, mờ đi bằng `opacity` chứ không gán token màu: chip có ba kiểu nền, trong đó nền
  // `primary` đặc của buổi đang đá đòi chữ sáng còn hai nền kia đòi chữ tối — một token cố định
  // thì luôn có một nền làm nó chìm hẳn. Mờ theo `currentColor` thì tự đúng ở cả ba.
  const range = (
    <span className="w-full truncate text-[11px] leading-tight font-medium tabular-nums opacity-75">
      {formatTimeRange(match.startAt, match.endAt)}
    </span>
  )

  // Tên sân ở chip CAO xuống dòng và ăn hết chiều cao còn lại (`flex-1`), thay vì cắt bằng "…"
  // ngay dòng đầu. Một chip hai tiếng cao gần trăm pixel mà cắt tên ở dòng một là bỏ trống hơn
  // nửa chip trong khi vẫn giấu mất thứ người ta cần đọc.
  //
  // Cắt phần thừa bằng `overflow-hidden` chứ không phải `line-clamp-<n>`: số dòng vừa đủ phụ
  // thuộc chiều cao chip, mà chiều cao chip là hàm của độ dài buổi đá — không có một con số nào
  // đúng cho cả buổi 1 tiếng lẫn buổi 3 tiếng. Đổi lại là mất dấu "…" ở dòng cuối.
  //
  // `[overflow-wrap:anywhere]` để một chuỗi dài không có dấu cách (tên sân viết liền, đường dẫn)
  // vẫn bẻ được thay vì đẩy ngang ra khỏi chip.
  const court = (
    <span className="min-h-0 w-full flex-1 overflow-hidden text-xs leading-snug [overflow-wrap:anywhere] opacity-90">
      {match.courtName}
    </span>
  )

  // Chip THẤP chỉ có một dòng ngang nên tên sân phải cắt: ở đó không có "chỗ còn trống" nào để
  // trải ra, và xuống dòng thì chữ tràn khỏi chip.
  const courtInline = (
    <span className="min-w-0 flex-1 truncate text-xs opacity-90">{match.courtName}</span>
  )

  // Chip chỉ in ra HAI thứ: khung giờ và tên sân. Nhãn giai đoạn đã bỏ — nền chip nói giai đoạn
  // rồi, mà chú giải dưới lịch nói nghĩa của nền, nên in thêm một dòng chữ nữa là nói lần thứ ba
  // cùng một điều, trên đúng thứ đang thiếu chỗ nhất.
  //
  // Chip cao xếp dọc, chip thấp xếp ngang. Cụm sĩ số + huy hiệu nổi ở góc nên có ở cả hai kiểu.
  const body = (
    <div
      // Bấm là MỞ THẺ, không phải mở trang chi tiết: phần lớn lần bấm chỉ để hỏi "mấy giờ, còn
      // chỗ không, mình đăng ký chưa" — ba câu đó nằm sẵn trong thẻ, trả lời xong người ta vẫn
      // đang đứng trên lịch. Trang chi tiết lùi lại sau nút "Xem chi tiết" ở cuối thẻ.
      onClick={() => setCardOpen(true)}
      className={cn(
        // KHÔNG `overflow-hidden` ở đây: cụm sĩ số + huy hiệu cố tình nhô ra ngoài mép chip, cắt
        // nó đi là mất đúng thứ đang muốn thấy. Chữ vẫn không tràn — mỗi dòng tự lo phần cắt của
        // mình (`truncate` cho khung giờ, `overflow-hidden` cho tên sân).
        "relative flex h-full w-full max-w-md min-w-0",
        // Owner nhấc chip lên được nên con trỏ là `move`; người khác chỉ bấm để mở thẻ xem nhanh.
        // Trận đã tới giờ vẫn để `move`: nó vẫn kéo được thật, chỉ là thả ra thì bật về kèm
        // toast — con trỏ nói về việc nhấc được hay không, không nói về việc có được phép dời.
        editable ? "cursor-move" : "cursor-pointer",
        info.isShort ? "items-center gap-1.5" : "flex-col gap-0.5",
      )}
    >
      {/* Hai trục nói ra bằng chữ cho trình đọc màn hình: một cái là nền chip, một cái là huy
          hiệu icon — mà cả hai thì trình đọc màn hình không đọc được cái nào. */}
      <span className="sr-only">
        {MATCH_PHASE_LABELS[phase]}. {MATCH_ATTENDANCE_LABELS[attendance]}.
      </span>
      {floatCluster}
      {info.isShort ? (
        <>
          {range}
          {courtInline}
        </>
      ) : (
        <>
          {range}
          {court}
        </>
      )}
    </div>
  )

  // Đang kéo hoặc đang là bóng mờ đi theo con trỏ: không bọc thẻ hover. Con trỏ lúc đó nằm
  // ngay trên chip, thẻ sẽ bung ra che đúng chỗ người ta đang ngắm để thả.
  if (info.isDragging || info.isMirror || info.isResizing) return body

  return (
    <HoverCard open={cardOpen} onOpenChange={setCardOpen}>
      {/* asChild vì Trigger mặc định dựng một <a>, mà chip đã nằm trong phần tử event do
          FullCalendar dựng — lồng thêm một link nữa là HTML sai và là hai đích bấm chồng nhau. */}
      <HoverCardTrigger asChild>{body}</HoverCardTrigger>
      <MatchHoverCardContent
        match={match}
        organizationId={organizationId}
        onOpenDetail={onOpenDetail}
        onEdit={onEdit}
        onCancel={onCancel}
      />
    </HoverCard>
  )
}
