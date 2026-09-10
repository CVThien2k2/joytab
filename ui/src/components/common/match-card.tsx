"use client"

import { Check, Lock, LogIn, LogOut, MapPin, Users } from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { Badge } from "@/components/ui/badge"
import { ParticipantFaces } from "@/components/common/participant-faces"
import { Button } from "@/components/ui/button"
import { useVoteMatch } from "@/hooks/use-matches-api"
import { formatDayLabel, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types/match"

/**
 * Trạng thái CHỖ của một buổi, nhìn từ người đang xem. Ba mức, và chỉ ba:
 *
 *  - `joined`: mình đã đăng ký.
 *  - `full`: hết chỗ, mình không có trong đó.
 *  - `open`: còn chỗ, đăng ký được.
 *
 * Buổi đã tới giờ / đã huỷ KHÔNG thuộc thang này (`null`): lúc đó câu hỏi không còn là "còn chỗ
 * không" mà là "buổi này ra sao", và câu đó do `MatchStatusBadge` trả lời.
 */
type SeatState = "joined" | "full" | "open" | null

function seatStateOf(match: MatchSummary): SeatState {
  if (match.voted) return "joined"
  if (match.voteClosedReason === "full") return "full"
  return match.voteClosedReason === null ? "open" : null
}

/**
 * Màu của viền thẻ và vạch dọc bên trái, theo trạng thái chỗ.
 *
 * Xanh = đã đăng ký, ĐỎ = hết chỗ, KHÔNG màu = còn chỗ đăng ký được. Chỉ một trục màu duy nhất
 * trên thẻ, và nó trả lời đúng câu người ta lướt danh sách để hỏi: "buổi này mình vào được
 * không". Trước đây vạch này tô theo GIAI ĐOẠN (chưa/đang/đã diễn ra) — nhưng giai đoạn đã có
 * nhãn chữ nói rồi, mà hai trục màu trên cùng một thẻ thì không ai nhớ cái nào là cái nào.
 *
 * Viền và nhãn cùng một màu cho cùng một trạng thái: hết chỗ là tin cần nói to, mà nói bằng
 * viền xám trong khi nhãn đỏ thì hai chỗ trên cùng một thẻ đang nói hai mức độ khác nhau.
 */
const SEAT_BORDER: Record<Exclude<SeatState, null>, string> = {
  joined: "border-green-500/45",
  full: "border-destructive/45",
  open: "border-border",
}

const SEAT_RAIL: Record<Exclude<SeatState, null>, string> = {
  joined: "bg-green-500",
  full: "bg-destructive",
  open: "bg-transparent",
}

/**
 * Nhãn chữ đi cùng tên sân.
 *
 * "Đủ chỗ" tô ĐỎ chứ không xám như vạch bên trái: vạch là màu nền, nói khẽ; còn nhãn là chỗ
 * mắt dừng lại, mà "hết chỗ rồi, đừng tính buổi này nữa" là tin cần nói to. Hai màu cho cùng
 * một trạng thái không mâu thuẫn — chúng ở hai mức âm lượng khác nhau.
 */
const SEAT_CHIP: Record<
  Exclude<SeatState, null>,
  { label: string; variant: "success" | "destructive" | "outline" }
> = {
  joined: { label: "Đã đăng ký", variant: "success" },
  full: { label: "Đủ chỗ", variant: "destructive" },
  open: { label: "Còn chỗ", variant: "outline" },
}

/**
 * Input: một buổi + trạng thái chỗ + thẻ này có cho đăng ký hay không.
 * Output: Nút hành động ở mép phải, hoặc `null` khi không có gì để làm.
 *
 *         Nút vẫn HIỆN ở những trạng thái không bấm được ("Đã đủ chỗ", "Đã tham gia"), chỉ là
 *         mờ đi: mọi hàng cùng kết thúc bằng một khối cùng cỡ nên danh sách thẳng cột, và câu
 *         trả lời "vì sao không đăng ký được" nằm ngay chỗ người ta định bấm.
 */
function ctaOf(seat: SeatState, canCancel: boolean) {
  if (seat === "full") return { label: "Đã đủ chỗ", icon: Lock, disabled: true, join: false }
  if (seat === "joined") {
    return canCancel
      ? { label: "Huỷ đăng ký", icon: LogOut, disabled: false, join: false }
      : { label: "Đã tham gia", icon: Check, disabled: true, join: false }
  }
  if (seat === "open")
    return { label: "Đăng ký tham gia", icon: LogIn, disabled: false, join: true }
  return null
}

/**
 * Input: một buổi + `votable` (thẻ có cho đăng ký ngay không).
 * Output: Một hàng buổi đá trong danh sách.
 *
 *         Dựng theo mẫu "Thẻ danh sách trận đấu" (Claude Design), đổi bảng màu sang token của
 *         Joytab. Bốn khối đọc từ trái sang, mỗi khối một câu hỏi:
 *
 *          1. KHUNG GIỜ — đi được không? Chữ mono, rộng cố định nên mọi hàng thẳng cột.
 *          2. SÂN — ở đâu? Tên sân kèm nhãn còn chỗ / hết chỗ, dưới là địa chỉ.
 *          3. AI ĐÃ ĐĂNG KÝ — avatar chồng lên nhau kèm sĩ số. Mặt người đọc nhanh hơn con số.
 *          4. NÚT — vào hay ra.
 *
 *         Dùng chung cho danh sách buổi sắp tới ở trang chủ và trang Lịch sử. Một định nghĩa
 *         cho cả hai — hai bản sao của cùng một thẻ thì sẽ có lúc một bên thêm nhãn mà bên kia
 *         không có.
 *
 *         CẢ thẻ mở trang chi tiết, dựng bằng một `button` phủ kín (`absolute inset-0`) nằm
 *         dưới nội dung: vùng chạm là trọn thẻ chứ không riêng phần chữ, mà nút đăng ký vẫn bấm
 *         được vì nó nổi lên trên. Nút-trong-nút là HTML không hợp lệ và trình duyệt sẽ tự tháo
 *         ra, nên không làm cách đó được.
 */
export function MatchCard({
  match,
  onSelect,
  votable = false,
}: {
  match: MatchSummary
  onSelect: (matchId: string) => void
  votable?: boolean
}) {
  const vote = useVoteMatch(match.organizationId)
  const seat = seatStateOf(match)
  const chip = seat ? SEAT_CHIP[seat] : null
  const cta = votable ? ctaOf(seat, match.canCancelVote) : null

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-card py-4 pr-4 pl-6 shadow-sm",
        seat ? SEAT_BORDER[seat] : "border-border",
        "transition-colors hover:bg-accent/50",
        "focus-within:ring-[3px] focus-within:ring-ring/50",
      )}
    >
      {/* Vạch dọc bám mép trái. Nằm trong một lớp TỰ CẮT thay vì tự bo góc: một dải rộng 4px
          không bo nổi bán kính 16px của thẻ (CSS co bán kính lại cho vừa bề rộng), nên góc
          vuông của nó thò ra ngoài đúng chỗ mép thẻ đang cong.
          
          Cắt ở lớp riêng chứ không `overflow-hidden` cả thẻ: thẻ còn phải cho tooltip tên
          người bung LÊN TRÊN mép trên của nó. 15px = 16px bo của thẻ trừ 1px viền, tức đúng
          đường cong phía trong. */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[15px]"
        aria-hidden="true"
      >
        <span
          className={cn("absolute inset-y-0 left-0 w-1", seat ? SEAT_RAIL[seat] : "bg-transparent")}
        />
      </span>

      {/* Nút phủ kín thẻ, nằm DƯỚI nội dung. Chữ bên trong là `sr-only` vì phần nhìn thấy đã
          nằm ngay trên nó. */}
      <button
        type="button"
        onClick={() => onSelect(match.id)}
        className="absolute inset-0 rounded-2xl outline-none"
      >
        <span className="sr-only">Xem chi tiết buổi {match.courtName}</span>
      </button>

      {/* Ngày + khung giờ. Mono để chữ số nào cũng cùng bề rộng — cả cột thẳng hàng như một
          bảng. Ngày nằm NGAY TRONG thẻ chứ không tách ra thành tiêu đề nhóm phía trên: một tổ
          chức đá vài buổi một tuần thì nhóm nào cũng chỉ có một thẻ, mà tiêu đề nhóm khi đó
          chiếm nhiều chỗ hơn cả cái nó gộp. */}
      <span className="pointer-events-none relative flex shrink-0 flex-col justify-center gap-0.5 sm:w-[132px]">
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {formatDayLabel(match.startAt)}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[15px] font-semibold">
          {formatTime(match.startAt)}
          <span className="text-muted-foreground">–</span>
          {formatTime(match.endAt)}
        </span>
      </span>

      {/* Sân + trạng thái + địa chỉ. `basis-55` để nó là khối XUỐNG DÒNG đầu tiên khi thẻ hẹp
          lại — giờ và nút thì không co được, còn tên sân thì cắt bớt vẫn đọc được. */}
      <span className="pointer-events-none relative flex min-w-0 flex-1 basis-55 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold tracking-tight">
            {match.courtName}
          </span>
          {chip ? <Badge variant={chip.variant}>{chip.label}</Badge> : null}
          {seat === null ? <MatchStatusBadge match={match} /> : null}
          {match.myAmount !== null ? (
            <Badge variant={match.myPaymentStatus === "unpaid" ? "destructive" : "success"}>
              {match.myPaymentStatus === "unpaid" ? "Chưa trả" : "Đã trả"}
            </Badge>
          ) : null}
        </span>

        {/* Địa chỉ chỉ hiện khi có: trận cũ tạo trước khi có ô này thì để trống, mà một dòng
            trống kèm icon ghim còn khó hiểu hơn là không có dòng nào. */}
        {match.address ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{match.address}</span>
          </span>
        ) : null}
      </span>

      {/* Ai đã đăng ký. Cụm này NHẬN chuột (khác mọi phần nội dung khác) vì mỗi mặt người phải
          hover được; đổi lại nó tự chuyển cú bấm lên trên, để "bấm chỗ nào cũng mở" vẫn đúng. */}
      <span className="pointer-events-none relative flex shrink-0 items-center gap-3">
        <span
          className="pointer-events-auto flex cursor-pointer items-center"
          onClick={() => onSelect(match.id)}
        >
          <ParticipantFaces participants={match.participantsPreview} total={match.playerCount} />
        </span>

        <span className="flex w-12 items-center justify-end gap-1.5 font-mono text-[13px] font-semibold text-muted-foreground">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          {match.playerCount}/{match.maxPlayers}
        </span>
      </span>

      {cta ? (
        <Button
          type="button"
          variant={cta.join ? "default" : "outline"}
          disabled={cta.disabled || vote.isPending}
          onClick={() => vote.mutate({ matchId: match.id, join: cta.join })}
          className="pointer-events-auto relative w-full sm:w-[172px]"
        >
          <cta.icon aria-hidden="true" />
          {cta.label}
        </Button>
      ) : null}
    </div>
  )
}
