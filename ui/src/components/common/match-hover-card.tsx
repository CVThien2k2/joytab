"use client"

import { ArrowRight, CalendarDays, CheckCircle2, LogIn, LogOut, Users, Wallet } from "lucide-react"
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
        <p className="text-xs text-muted-foreground">
          {cancelLockedText(match.voteClosedReason, phase)}
        </p>
      )
    }

    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={vote.isPending}
        onClick={() => vote.mutate({ matchId: match.id, join: false })}
      >
        <LogOut aria-hidden="true" />
        Huỷ đăng ký
      </Button>
    )
  }

  if (closed) return <p className="text-xs text-muted-foreground">{closed}</p>

  return (
    <Button
      type="button"
      className="w-full"
      disabled={vote.isPending}
      onClick={() => vote.mutate({ matchId: match.id, join: true })}
    >
      <LogIn aria-hidden="true" />
      Đăng ký tham gia
    </Button>
  )
}

export type MatchHoverCardContentProps = {
  match: MatchSummary
  organizationId: string
  onOpenDetail: (matchId: string) => void
}

/**
 * Input: một trận + cách mở trang chi tiết của nó.
 * Output: Thẻ chi tiết hiện khi rê chuột vào chip.
 *
 *         Chia làm hai phần rõ rệt: PHẦN ĐỌC ở trên (ở đâu, lúc nào, mấy người, mình phải trả
 *         bao nhiêu) và PHẦN LÀM ở dưới, có viền và nền riêng. Trước đây hai loại nội dung
 *         này xếp lẫn vào nhau thành một cột chữ đều nhau, nên nút bấm không nổi lên như nút.
 *
 *         Dòng ngày giờ được đóng khung nhạt vì đó là thứ hay tìm nhất trên thẻ này — thẻ bung
 *         ra từ chính chip vừa rê vào, nên câu "trận nào" đã rõ, còn lại là "lúc nào".
 *
 *         Chỉ đọc `MatchSummary` mà lịch đã có sẵn, KHÔNG gọi thêm API: rê chuột là thao tác
 *         người ta làm liên tục và vô ý, biến nó thành một request là biến một cái liếc mắt
 *         thành tải trọng cho server và thành một khoảnh khắc nhấp nháy cho người dùng.
 *
 *         Đổi lại, thẻ không có danh sách người tham gia — đó là lý do vẫn còn nút mở trang
 *         chi tiết ở cuối.
 */
export function MatchHoverCardContent({
  match,
  organizationId,
  onOpenDetail,
}: MatchHoverCardContentProps) {
  const filled = match.maxPlayers > 0 ? Math.min(match.playerCount / match.maxPlayers, 1) : 0
  const remaining = Math.max(match.maxPlayers - match.playerCount, 0)
  const canceled = match.status === "canceled"

  return (
    <HoverCardContent className="w-80 overflow-hidden p-0" align="start">
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

        <VoteAction match={match} organizationId={organizationId} />

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onOpenDetail(match.id)}
        >
          Xem chi tiết
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </HoverCardContent>
  )
}
