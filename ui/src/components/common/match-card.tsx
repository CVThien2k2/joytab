"use client"

import { Check, Lock, LogIn, LogOut, MapPin, Pencil, Trash2, Users } from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { Badge } from "@/components/ui/badge"
import { ParticipantFaces } from "@/components/common/participant-faces"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
 * Input: nhãn tooltip + icon + nhãn cho trình đọc màn hình + màu + việc cần làm.
 * Output: Một nút CHỈ ICON kèm tooltip khi rê chuột.
 *
 *         Icon trơ không tự nói được nó làm gì, mà đây lại là hai việc KHÔNG hoàn tác được
 *         (đổi giờ một buổi người khác đã xếp lịch đi, huỷ hẳn một buổi) — đoán sai là bấm sai.
 *         `TooltipProvider` đã bọc sẵn ở `AppShell`, cả hai chỗ dùng thẻ này đều nằm trong đó.
 *
 *         `aria-label` giữ nguyên bên cạnh tooltip: tooltip là chuyện của con chuột, còn trình
 *         đọc màn hình đọc `aria-label` — và nó cần nói rõ buổi NÀO, vì một danh sách có hàng
 *         chục nút "Sửa" giống nhau.
 *
 *         Khai ở đây chứ không inline hai lần: hai nút chỉ khác nhau đúng icon, nhãn và màu.
 */
function IconAction({
  label,
  srLabel,
  icon: Icon,
  className,
  onClick,
}: {
  label: string
  srLabel: string
  icon: typeof Pencil
  className: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Viền + màu theo việc: sửa mang màu nhấn của app, huỷ mang màu cảnh báo. Nền vẫn
            trong suốt (`outline`) nên chúng không tranh chỗ với nút đăng ký tô đặc — và
            `hover:text-*` phải khai lại vì biến thể `outline` tự kéo màu chữ về `foreground`. */}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={className}
          aria-label={srLabel}
          onClick={onClick}
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
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
 *         Thẻ KHÔNG mở trang chi tiết: chỉ những nút bên trong nó là bấm được. Trước đây cả
 *         thẻ là một `button` phủ kín, và mọi phần nội dung phải tắt chuột (`pointer-events`)
 *         để nhường cú bấm cho nó — cả bộ đó đi cùng lúc với cái nút.
 *
 *         Sửa và huỷ là hai nút CHỈ ICON, nhỏ hơn một cỡ và đứng ngay cạnh TÊN SÂN: chúng là
 *         việc hiếm của riêng chủ tổ chức, còn nút đăng ký thì ai cũng bấm và bấm hàng tuần —
 *         cho cả ba cùng cỡ và cùng nằm ở mép phải là ba thứ tranh nhau một chỗ. Hẹp hơn `sm`
 *         thì chúng ghim vào góc trên-phải thay vì chiếm một hàng riêng. Cả hai chỉ hiện khi
 *         trận còn sửa được (chưa tới giờ, chưa chốt tiền): cùng luật với BE (MATCH_011 /
 *         MATCH_015), hiện nút để rồi ăn lỗi thì thà đừng hiện.
 */
export function MatchCard({
  match,
  votable = false,
  onEdit,
  onCancel,
}: {
  match: MatchSummary
  votable?: boolean
  /** Chỉ chủ tổ chức truyền hai hàm này; không truyền = không vẽ nút nào. */
  onEdit?: (match: MatchSummary) => void
  onCancel?: (match: MatchSummary) => void
}) {
  const vote = useVoteMatch(match.organizationId)
  const seat = seatStateOf(match)
  const chip = seat ? SEAT_CHIP[seat] : null
  const cta = votable ? ctaOf(seat, match.canCancelVote) : null
  // Sửa/huỷ chỉ mở khi trận chưa tới giờ và chưa chốt tiền. `voteClosedReason` đã gộp cả hai
  // lý do đóng đó (`started` / `canceled`) nên không phải so giờ lần nữa ở đây.
  const editable =
    Boolean(onEdit ?? onCancel) && match.status === "open" && match.voteClosedReason !== "started"

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border bg-card py-4 pr-4 pl-6 shadow-sm",
        seat ? SEAT_BORDER[seat] : "border-border",
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

      {/* Ngày + khung giờ. Mono để chữ số nào cũng cùng bề rộng — cả cột thẳng hàng như một
          bảng. Ngày nằm NGAY TRONG thẻ chứ không tách ra thành tiêu đề nhóm phía trên: một tổ
          chức đá vài buổi một tuần thì nhóm nào cũng chỉ có một thẻ, mà tiêu đề nhóm khi đó
          chiếm nhiều chỗ hơn cả cái nó gộp. */}
      {/* `w-full` khi hẹp: khối giờ chiếm HẲN một hàng thay vì chen với tên sân. Chen thì cả
          hai cùng thua — giờ không co được nên tên sân lãnh hết, và một cái tên bị cắt còn
          "Sân Nghĩa ..." thì thẻ mất đúng thứ người ta dò để tìm buổi. */}
      {/* `pr-16` chừa chỗ cho cặp nút sửa/huỷ đang ghim ở góc trên-phải thẻ khi hẹp — ở khổ đó
          khối này là hàng trên cùng nên nó là hàng đi qua chỗ hai cái nút. */}
      <span className="flex w-full shrink-0 flex-col justify-center gap-0.5 pr-16 sm:w-[132px] sm:pr-0">
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {formatDayLabel(match.startAt)}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[15px] font-semibold">
          {formatTime(match.startAt)}
          <span className="text-muted-foreground">–</span>
          {formatTime(match.endAt)}
        </span>
      </span>

      {/* Sân + trạng thái + địa chỉ.

          `basis-80` (320px) quyết định thứ tự XUỐNG DÒNG của cả thẻ: hàng nào không đủ chỗ cho
          nó thì cụm avatar bị đẩy xuống dòng TRƯỚC, chứ không phải tên sân bị co lại — mất mấy
          cái mặt người thì vẫn còn con số sĩ số ngay cạnh nói thay, còn mất tên sân thì không
          gì nói thay được. Trước đây là `basis-55` (220px) và `truncate` cắt cả những tên ngắn
          như "Sân Kim Mã" ngay ở khổ desktop hẹp.

          Là khối `flex-1` DUY NHẤT của thẻ, nên nó cũng là thứ giữ mọi cột bên phải nó thẳng
          hàng: ba khối kia có bề ngang cố định, chỗ dư dồn hết về đây. */}
      <span className="relative flex min-w-0 flex-1 basis-80 flex-col gap-1">
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

      {editable ? (
        /* Sửa/huỷ đứng NGAY SAU khối tên, không ở mép phải thẻ: chúng thao tác lên chính buổi
           này, mà mép phải là chỗ của nút đăng ký — thứ mọi người bấm hàng tuần.

           Là khối RIÊNG của thẻ chứ không nằm trong hàng tên: thẻ đã `items-center`, nên đứng
           riêng thì hai nút tự căn giữa theo chiều dọc như cụm avatar và nút đăng ký. Nằm
           trong hàng tên thì chúng căn theo dòng chữ đó, tức hơi cao so với tâm thẻ khi bên
           dưới còn một dòng địa chỉ.

           Khối tên là `flex-1` nên nó ăn hết chỗ dư, đẩy hai nút tới một vị trí GIỐNG NHAU ở
           mọi hàng — bề ngang của ba khối còn lại (giờ, cụm avatar, nút đăng ký) đều đã cố
           định. Dính ngay sau nhãn trạng thái thì mỗi hàng tên dài ngắn khác nhau là cả cột so le.

           Hẹp hơn `sm` thì ghim vào góc trên-phải THẺ (`absolute`, thụt vào 16px đúng bằng
           padding của thẻ): ở khổ đó mọi khối đã xếp dọc, thêm một hàng chỉ để chứa hai cái
           icon là thẻ dài thêm mà không nói thêm gì.

           Chuột bật lại ở TỪNG nút chứ không ở vỏ này — xem chú thích trong `IconAction`. */
        <span className="absolute top-4 right-4 flex shrink-0 items-center gap-1 sm:static sm:top-auto sm:right-auto">
          <IconAction
            label="Sửa buổi này"
            icon={Pencil}
            srLabel={`Sửa buổi ${match.courtName}`}
            className="border-primary/40 text-primary hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit?.(match)}
          />
          <IconAction
            label="Huỷ buổi này"
            icon={Trash2}
            srLabel={`Huỷ buổi ${match.courtName}`}
            className="border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onCancel?.(match)}
          />
        </span>
      ) : null}

      {/* Ai đã đăng ký. Mỗi mặt người vẫn hover được để hiện tên — đó là việc duy nhất cụm
          này làm, bấm vào không còn mở gì nữa.

          `sm:w-[158px]` là bề ngang của trường hợp ĐÔNG NHẤT: 4 mặt + viên "+N" (26px, chồng
          nhau 8px) = 98px, cộng khoảng cách 12px và ô sĩ số 48px. Cố định ở đó nên buổi 2
          người và buổi 20 người chiếm đúng một chỗ như nhau — nếu để nó tự co thì mọi thứ
          đứng bên trái nó (kể cả cặp nút sửa/huỷ) xê dịch theo từng hàng.

          `justify-between` để hai đầu bám hai mép: mặt người thành một cột, sĩ số thành một
          cột, thay vì cả cụm dồn về một phía và lệch nhau giữa các hàng. */}
      <span className="flex shrink-0 items-center gap-3 sm:w-[158px] sm:justify-between">
        <ParticipantFaces participants={match.participantsPreview} total={match.playerCount} />

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
          className="w-full sm:w-[172px]"
        >
          <cta.icon aria-hidden="true" />
          {cta.label}
        </Button>
      ) : null}
    </div>
  )
}
