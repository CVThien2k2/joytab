"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { CalendarDays, MapPin, Pencil, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useCancelMatch, useMatch } from "@/hooks/use-matches-api"
import { formatDateTime, formatTimeRange } from "@/lib/format"
import { useAuthStore } from "@/providers/auth-store-provider"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { MatchFormDialog } from "../_components/match-form-dialog"
import { ParticipantList } from "./_components/participant-list"
import { SettlementSection } from "./_components/settlement-section"
import { VoteHistory } from "./_components/vote-history"
import { VotePanel } from "./_components/vote-panel"

/**
 * Input: `matchId` trên URL.
 * Output: Trang chi tiết một trận: thông tin, đăng ký, người tham gia, lịch sử, và chi phí.
 *
 *         Bốn khối theo đúng thứ tự người ta cần: "đá ở đâu lúc nào" → "tôi có đi không" →
 *         "ai đi cùng" → "hết bao nhiêu tiền".
 */
export default function MatchDetailPage() {
  const params = useParams<{ orgId: string; matchId: string }>()
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"
  const currentUserId = useAuthStore((state) => state.user?.userId) ?? ""

  const { data: match, isPending, isError } = useMatch(params.matchId)
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const cancelMatch = useCancelMatch(organization.id, () => {
    setCancelOpen(false)
    router.push(`/orgs/${organization.id}/matches`)
  })

  if (isPending) {
    return (
      <main className="flex flex-1 items-center justify-center py-16">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    )
  }

  if (isError || !match) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">
          Không tìm thấy trận này. Có thể nó đã bị xoá hoặc bạn không còn ở tổ chức đó.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/orgs/${organization.id}/matches`}>Về lịch thi đấu</Link>
        </Button>
      </main>
    )
  }

  const canEdit = isOwner && match.status === "open"

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">{match.courtName}</h1>
              {match.status === "canceled" ? <Badge variant="destructive">Đã huỷ</Badge> : null}
              {match.status === "settled" ? <Badge variant="secondary">Đã chốt tiền</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(match.startAt)}</p>
          </div>

          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden="true" />
                Sửa
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCancelOpen(true)}>
                <Trash2 aria-hidden="true" />
                Huỷ trận
              </Button>
            </div>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{match.courtName}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{formatTimeRange(match.startAt, match.endAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              {match.playerCount}/{match.maxPlayers} người · hệ số nam ×{match.maleRatio}
            </span>
          </div>
        </dl>

        {match.note ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">{match.note}</p>
        ) : null}
      </section>

      <VotePanel match={match} />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Người tham gia ({match.playerCount})</h2>
        <ParticipantList participants={match.participants} currentUserId={currentUserId} />
      </section>

      <VoteHistory matchId={match.id} />

      <SettlementSection match={match} isOwner={isOwner} currentUserId={currentUserId} />

      {canEdit ? (
        <MatchFormDialog
          organizationId={organization.id}
          open={editOpen}
          onOpenChange={setEditOpen}
          match={match}
        />
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Huỷ trận này?</DialogTitle>
            <DialogDescription>
              Trận sẽ hiện là đã huỷ với mọi người đã đăng ký. Lịch sử đăng ký vẫn giữ lại, nhưng
              không đăng ký được nữa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Giữ nguyên
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelMatch.isPending}
              onClick={() => cancelMatch.mutate(match.id)}
            >
              Huỷ trận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
