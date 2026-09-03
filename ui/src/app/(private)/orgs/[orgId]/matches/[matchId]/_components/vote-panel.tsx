"use client"

import { CircleCheck, LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVoteMatch } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { cancelLockedText, matchPhase, voteClosedText } from "@/lib/match-phase"
import type { MatchDetail } from "@/types/match"

/**
 * Input: chi tiết trận.
 * Output: Khối đăng ký / huỷ đăng ký, kèm lý do khi không thao tác được.
 */
export function VotePanel({ match }: { match: MatchDetail }) {
  const vote = useVoteMatch(match.organizationId)
  const now = useNow()
  const phase = matchPhase(match, now)
  const closed = voteClosedText(match.voteClosedReason, phase)

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
            {cancelLockedText(match.voteClosedReason, phase)}
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
