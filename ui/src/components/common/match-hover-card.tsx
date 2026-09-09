"use client"

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Users,
  Wallet,
} from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { Button } from "@/components/ui/button"
import { HoverCardContent } from "@/components/ui/hover-card"
import { useVoteMatch } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format"
import { cancelLockedText, matchPhase, voteClosedText } from "@/lib/match-phase"
import { cn } from "@/lib/utils"
import { MATCH_CANCEL_LOCK_HOURS } from "@/schema/match"
import type { MatchSummary } from "@/types/match"

const CANCEL_LOCK_MS = MATCH_CANCEL_LOCK_HOURS * 60 * 60 * 1000

/**
 * Input: một trận + tổ chức của nó.
 * Output: Nút đăng ký / huỷ đăng ký, hoặc câu giải thích khi không thao tác được.
 *
 *         Tách thành component RIÊNG để `useVoteMatch` chỉ chạy khi thẻ đã mở: mỗi chip trên
 *         lịch dựng một thẻ hover, mà một tuần dày có thể có vài chục chip — treo một
 *         mutation cho từng cái là trả giá cho thứ gần như không ai bấm.
 *
 *         `MatchSummary` không có `canCancelVote` (chỉ `MatchDetail` mới có), nên cửa 2 tiếng
 *         tính lại ở đây bằng đúng hằng số BE dùng. Đây là để GIẢI THÍCH sớm, không phải để
 *         chặn — chặn vẫn là việc của server ở từng request.
 */
function VoteAction({ match, organizationId }: { match: MatchSummary; organizationId: string }) {
  const vote = useVoteMatch(organizationId)
  const now = useNow()
  const phase = matchPhase(match, now)
  const closed = voteClosedText(match.voteClosedReason, phase)

  if (match.voted) {
    const locked = new Date(match.startAt).getTime() - now <= CANCEL_LOCK_MS

    if (locked) {
      return (
        <p className="w-full text-xs text-muted-foreground">
          {cancelLockedText(match.voteClosedReason, phase)}
        </p>
      )
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        disabled={vote.isPending}
        onClick={() => vote.mutate({ matchId: match.id, join: false })}
      >
        <LogOut aria-hidden="true" />
        Huỷ đăng ký
      </Button>
    )
  }

  if (closed) return <p className="w-full text-xs text-muted-foreground">{closed}</p>

  return (
    <Button
      type="button"
      size="sm"
      className="flex-1"
      disabled={vote.isPending}
      onClick={() => vote.mutate({ matchId: match.id, join: true })}
    >
      <LogIn aria-hidden="true" />
      Đăng ký tham gia
    </Button>
  )
}

export type MatchSummaryPanelProps = {
  match: MatchSummary
  organizationId: string
  onOpenDetail: (matchId: string) => void
  /**
   * Owner: sửa và huỷ NGAY trên lịch. Không truyền = người xem không có quyền, hàng nút biến mất.
   *
   * Hai hàm chứ không một cờ `isOwner`: hộp thoại sửa và hộp thoại huỷ phải sống ở tầng trang
   * (Radix đóng thẻ hover khi bấm, hộp thoại nằm trong thẻ sẽ bị unmount ngay lúc vừa mở), nên
   * thẻ này chỉ báo "người ta vừa bấm" chứ không tự dựng gì.
   */
  onEdit?: (match: MatchSummary) => void
  onCancel?: (match: MatchSummary) => void
}

/**
 * Input: một trận + cách mở trang chi tiết của nó.
 * Output: Ruột của bản xem nhanh một trận, KHÔNG kèm khung bao ngoài.
 *
 *         Không có khung là chủ ý: cùng nội dung này xuất hiện ở hai khung khác nhau — thẻ
 *         hover (rê chuột trên desktop) và hộp thoại (bấm vào chip, đường duy nhất trên thiết
 *         bị cảm ứng vì ở đó không có "rê"). Hai bản chép tay là hai chỗ sẽ trôi mỗi cái một
 *         kiểu, mà đây đúng là chỗ phải giống nhau: cùng một trận thì hai lối mở phải nói cùng
 *         một điều.
 *
 *         Chia làm hai phần rõ rệt: PHẦN ĐỌC ở trên (ở đâu, lúc nào, mấy người, mình phải trả
 *         bao nhiêu) và PHẦN LÀM ở dưới, có viền và nền riêng. Trước đây hai loại nội dung
 *         này xếp lẫn vào nhau thành một cột chữ đều nhau, nên nút bấm không nổi lên như nút.
 *
 *         Dòng ngày giờ được đóng khung nhạt vì đó là thứ hay tìm nhất ở đây — bản xem nhanh
 *         bung ra từ chính chip vừa chạm vào, nên câu "trận nào" đã rõ, còn lại là "lúc nào".
 *
 *         Chỉ đọc `MatchSummary` mà lịch đã có sẵn, KHÔNG gọi thêm API: rê chuột là thao tác
 *         người ta làm liên tục và vô ý, biến nó thành một request là biến một cái liếc mắt
 *         thành tải trọng cho server và thành một khoảnh khắc nhấp nháy cho người dùng.
 *
 *         Đổi lại, ở đây không có danh sách người tham gia — đó là lý do vẫn còn nút mở trang
 *         chi tiết ở cuối.
 */
export function MatchSummaryPanel({
  match,
  organizationId,
  onOpenDetail,
  onEdit,
  onCancel,
}: MatchSummaryPanelProps) {
  const now = useNow()
  const filled = match.maxPlayers > 0 ? Math.min(match.playerCount / match.maxPlayers, 1) : 0
  const remaining = Math.max(match.maxPlayers - match.playerCount, 0)
  const canceled = match.status === "canceled"

  // Cùng luật với trang chi tiết, cố tình chép lại NGUYÊN ba điều kiện chứ không nới ra: sửa
  // hay huỷ một buổi đã tới giờ là viết lại một chuyện đã xảy ra (BE ném MATCH_015 / MATCH_016),
  // còn trận đã chốt tiền thì mọi con số đã đi vào phần thanh toán của từng người.
  const canManage =
    Boolean(onEdit && onCancel) && match.status === "open" && matchPhase(match, now) === "upcoming"

  return (
    <>
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-semibold", canceled && "line-through")}>
              {match.courtName}
            </p>
            {match.organizationName ? (
              <p className="truncate text-xs text-muted-foreground">{match.organizationName}</p>
            ) : null}
          </div>
          <MatchStatusBadge match={match} />
        </div>

        <p className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-sm font-medium">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="tabular-nums">
            {formatDateTime(match.startAt)} - {formatTime(match.endAt)}
          </span>
        </p>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              Đã đăng ký
            </span>
            <span className="font-medium tabular-nums">
              {match.playerCount}/{match.maxPlayers} người
              <span className="font-normal text-muted-foreground">
                {remaining > 0 ? ` · còn ${remaining} chỗ` : " · đã đủ"}
              </span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${filled * 100}%` }}
            />
          </div>
        </div>

        {match.maleRatio !== 1 ? (
          <p className="text-xs text-muted-foreground">
            Hệ số nam <span className="tabular-nums">×{match.maleRatio}</span>
          </p>
        ) : null}

        {match.myAmount !== null ? (
          <p className="flex items-center gap-1.5 text-xs">
            <Wallet className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            Bạn phải trả{" "}
            <span className="font-semibold tabular-nums">{formatMoney(match.myAmount)}đ</span>
            {match.myPaymentStatus === "unpaid" ? (
              <span className="text-muted-foreground">· chưa trả</span>
            ) : null}
          </p>
        ) : null}

        {match.note ? (
          <p className="line-clamp-2 border-l-2 pl-2 text-xs text-muted-foreground">{match.note}</p>
        ) : null}
      </div>

      {/* Phần LÀM: viền trên và nền nhạt để tách khỏi phần đọc — nút nằm trên nền riêng thì
          nhìn một cái là biết đâu là chỗ bấm, không phải đọc hết thẻ mới thấy. */}
      <div className="space-y-2 border-t bg-muted/40 p-3">
        {match.voted ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            Bạn đã đăng ký buổi này
          </p>
        ) : null}

        {/* Đăng ký và Xem chi tiết đứng NGANG HÀNG, chia đôi bề ngang: hai việc ngang cấp
            nhau, xếp dọc thì cái trên trông như bước một của cái dưới. Thẻ cũng ngắn lại một
            nấc, mà nó bung ra đè lên chính cái lịch người ta đang đọc.

            `flex-wrap` + `w-full` trên mấy dòng giải thích của `VoteAction`: khi hết hạn đăng
            ký thì chỗ nút đăng ký là một câu chữ, câu đó chiếm trọn hàng và đẩy "Xem chi tiết"
            xuống hàng dưới — chữ giải thích mà bị ép còn nửa thẻ thì vỡ thành bốn dòng.

            `size="sm"` để hai nhãn dài nhất ("Đăng ký tham gia", "Huỷ đăng ký") vẫn nằm gọn
            trong 144px mỗi nút, và để cả khu bấm cùng một cỡ với hàng Sửa/Huỷ của owner. */}
        <div className="flex flex-wrap items-center gap-2">
          <VoteAction match={match} organizationId={organizationId} />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onOpenDetail(match.id)}
          >
            Xem chi tiết
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>

        {/* Hàng của owner, tách xuống dưới cùng và chia đôi bề ngang: hai việc này KHÁC loại với
            ba thứ trên (đăng ký, xem chi tiết là việc của người đi đá), nên chúng không được
            đứng lẫn vào đó — nhất là "Huỷ", thứ không có nút hoàn tác.

            Đặt ở đây thay vì bắt vào trang chi tiết: sửa giờ một buổi là việc owner làm trong
            lúc đang nhìn CẢ TUẦN, để né trùng giờ với buổi khác — mà vào trang chi tiết thì mất
            đúng cái nhìn đó, sửa xong lại phải quay ra kiểm tra lại. */}
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit?.(match)}
            >
              <Pencil aria-hidden="true" />
              Sửa
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={() => onCancel?.(match)}
            >
              <Trash2 aria-hidden="true" />
              Huỷ
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}

/**
 * Input: giống `MatchSummaryPanel`.
 * Output: Bản xem nhanh trong thẻ hover, hiện khi rê chuột vào chip trên lịch.
 *
 *         Chỉ là cái khung: mọi nội dung nằm ở `MatchSummaryPanel`. `p-0` vì hai phần bên trong
 *         tự có padding riêng — phần LÀM cần nền chạy hết mép thẻ mới tách được khỏi phần đọc.
 */
export function MatchHoverCardContent(props: MatchSummaryPanelProps) {
  return (
    <HoverCardContent className="w-80 overflow-hidden p-0" align="start">
      <MatchSummaryPanel {...props} />
    </HoverCardContent>
  )
}
