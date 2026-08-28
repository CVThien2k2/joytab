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
 *         Cột trái đi theo đúng thứ tự người ta cần: "đá ở đâu lúc nào" → "tôi có đi không" →
 *         "ai đi cùng" → "hết bao nhiêu tiền".
 *
 *         Lịch sử đăng ký tách sang cột phải vì nó là thứ ĐỐI CHIẾU chứ không phải một bước
 *         trong mạch đó: người ta mở nó ra để so với danh sách người tham gia đang hiện, mà
 *         nằm dưới đáy trang thì hai thứ cần so lại không bao giờ ở cùng một khung hình.
 *         Cột phải dính theo màn hình cũng vì vậy.
 *
 *         Dưới `lg` xếp lại thành một cột, lịch sử xuống cuối: ở đó không có chỗ cho hai cột,
 *         và nó vẫn là thứ ít cần nhất.
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
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold">{match.courtName}</h1>
                  {match.status === "canceled" ? <Badge variant="destructive">Đã huỷ</Badge> : null}
                  {match.status === "settled" ? (
                    <Badge variant="secondary">Đã chốt tiền</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(match.startAt)}
                </p>
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
                <CalendarDays
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
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

          <SettlementSection match={match} isOwner={isOwner} currentUserId={currentUserId} />
        </div>

        {/* `self-start` để cột không bị kéo cao bằng cột trái — `sticky` chỉ có tác dụng khi
            phần tử còn chỗ để trượt bên trong khung cha của nó. `top-18` chừa đúng thanh
            header dính ở trên (h-14) cộng một khoảng thở. */}
        <aside className="lg:sticky lg:top-18 lg:self-start">
          <VoteHistory matchId={match.id} />
        </aside>
      </div>

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
