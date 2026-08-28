"use client"

import { ArrowRight, LogIn, LogOut } from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { Button } from "@/components/ui/button"
import { HoverCardContent } from "@/components/ui/hover-card"
import { useVoteMatch } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MATCH_CANCEL_LOCK_HOURS } from "@/schema/match"
import type { MatchSummary } from "@/types/match"

const CANCEL_LOCK_MS = MATCH_CANCEL_LOCK_HOURS * 60 * 60 * 1000

/** Vì sao không đăng ký được nữa. Cùng chữ với khối vote ở trang chi tiết. */
function closedReasonText(reason: MatchSummary["voteClosedReason"]): string | null {
  if (reason === "full") return "Trận đã đủ người."
  if (reason === "started") return "Trận đã bắt đầu nên không đăng ký được nữa."
  if (reason === "canceled") return "Trận đã bị huỷ."
  return null
}

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
  const closed = closedReasonText(match.voteClosedReason)

  if (match.voted) {
    const locked = new Date(match.startAt).getTime() - now <= CANCEL_LOCK_MS

    if (locked) {
      return (
        <p className="text-xs text-muted-foreground">
          {match.voteClosedReason === "started"
            ? "Bạn đã đăng ký. Trận đã bắt đầu."
            : `Bạn đã đăng ký. Không huỷ được khi còn dưới ${MATCH_CANCEL_LOCK_HOURS} tiếng nữa là tới giờ chơi.`}
        </p>
      )
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
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
      size="sm"
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
  const canceled = match.status === "canceled"

  return (
    <HoverCardContent className="w-80 space-y-3" align="start">
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

      <p className="text-xs text-muted-foreground">
        {formatDateTime(match.startAt)} - {formatTime(match.endAt)}
      </p>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Đã đăng ký</span>
          <span className="font-medium tabular-nums">
            {match.playerCount}/{match.maxPlayers} người
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

      {match.note ? <p className="line-clamp-2 text-xs">{match.note}</p> : null}

      {match.myAmount !== null ? (
        <p className="text-xs">
          Bạn phải trả{" "}
          <span className="font-semibold tabular-nums">{formatMoney(match.myAmount)}đ</span>
          {match.myPaymentStatus === "unpaid" ? (
            <span className="text-muted-foreground"> · chưa trả</span>
          ) : null}
        </p>
      ) : null}

      <VoteAction match={match} organizationId={organizationId} />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-between"
        onClick={() => onOpenDetail(match.id)}
      >
        Xem chi tiết
        <ArrowRight aria-hidden="true" />
      </Button>
    </HoverCardContent>
  )
}
