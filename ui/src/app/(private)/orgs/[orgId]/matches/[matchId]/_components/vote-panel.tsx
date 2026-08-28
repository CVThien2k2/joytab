"use client"

import { CircleCheck, LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVoteMatch } from "@/hooks/use-matches-api"
import { MATCH_CANCEL_LOCK_HOURS } from "@/schema/match"
import type { MatchDetail } from "@/types/match"

/**
 * Input: lý do vote đang đóng.
 * Output: Câu giải thích cho người dùng.
 *
 *         Luôn NÓI RA lý do thay vì chỉ làm mờ nút: nút mờ không giải thích được là "hết chỗ"
 *         hay "đã tới giờ", mà hai chuyện đó dẫn tới hai hành động khác nhau.
 */
function closedReasonText(reason: MatchDetail["voteClosedReason"]): string | null {
  if (reason === "full") return "Trận đã đủ người."
  if (reason === "started") return "Trận đã bắt đầu nên không đăng ký được nữa."
  if (reason === "canceled") return "Trận đã bị huỷ."
  return null
}

/**
 * Input: chi tiết trận.
 * Output: Khối đăng ký / huỷ đăng ký, kèm lý do khi không thao tác được.
 */
export function VotePanel({ match }: { match: MatchDetail }) {
  const vote = useVoteMatch(match.organizationId)
  const closed = closedReasonText(match.voteClosedReason)

  if (match.voted) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Bạn đã đăng ký trận này
        </p>

        {match.canCancelVote ? (
          <Button
            type="button"
            variant="outline"
            disabled={vote.isPending}
            onClick={() => vote.mutate({ matchId: match.id, join: false })}
          >
            <LogOut aria-hidden="true" />
            Huỷ đăng ký
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {match.voteClosedReason === "started"
              ? "Trận đã bắt đầu."
              : `Không huỷ được khi còn dưới ${MATCH_CANCEL_LOCK_HOURS} tiếng nữa là tới giờ chơi.`}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Bạn chưa đăng ký</p>
        {closed ? <p className="mt-0.5 text-xs text-muted-foreground">{closed}</p> : null}
      </div>

      <Button
        type="button"
        disabled={Boolean(closed) || vote.isPending}
        onClick={() => vote.mutate({ matchId: match.id, join: true })}
      >
        <LogIn aria-hidden="true" />
        Đăng ký tham gia
      </Button>
    </div>
  )
}
