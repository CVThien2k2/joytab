"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { CalendarDays, History, MapPin, Pencil, Trash2, Users } from "lucide-react"
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
import { useCancelMatch, useMatch, useSettlement } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { formatDateTime, formatTimeRange } from "@/lib/format"
import { matchPhase } from "@/lib/match-phase"
import { useAuthStore } from "@/providers/auth-store-provider"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { MatchFormDialog } from "../_components/match-form-dialog"
import { ParticipantList } from "./_components/participant-list"
import { SettlementSection } from "./_components/settlement-section"
import { VoteHistoryDialog } from "./_components/vote-history-dialog"
import { VotePanel } from "./_components/vote-panel"

/**
 * Input: `matchId` trên URL.
 * Output: Trang chi tiết một trận: thông tin, đăng ký, người tham gia, lịch sử, và chi phí.
 *
 *         MỘT cột dọc, mọi khổ màn hình, theo đúng thứ tự người ta cần: "đá ở đâu lúc nào" →
 *         "tôi có đi không" → "ai đi cùng" → "hết bao nhiêu tiền".
 *
 *         Không chia đôi nữa: chia đôi thì mỗi khối chỉ còn nửa bề ngang, mà không khối nào
 *         trong mạch trên là thứ đọc song song với khối khác — người ta đi hết một khối rồi
 *         mới xuống khối sau.
 *
 *         Lịch sử đăng ký KHÔNG nằm trong mạch đó nữa mà chuyển vào hộp thoại, mở khi có người
 *         bấm: nó là thứ xem lại khi có tranh cãi, còn để giữa trang thì ai cũng phải cuộn qua
 *         vài chục dòng log mới tới phần chi phí.
 */
export default function MatchDetailPage() {
  const params = useParams<{ orgId: string; matchId: string }>()
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"
  const currentUserId = useAuthStore((state) => state.user?.userId) ?? ""
  const now = useNow()

  const { data: match, isPending, isError } = useMatch(params.matchId)
  // Cùng query key với khu chi phí nên React Query chỉ gọi MỘT lần; trang cần nó để dán tiền
  // vào đúng dòng người tham gia.
  const { data: settlement } = useSettlement(params.matchId, match?.status === "settled")
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
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

  // Sửa và huỷ đều chỉ mở khi trận CHƯA tới giờ.
  //
  // Sửa: đang đá hay đá xong rồi thì thông tin của trận là thứ mọi người đã đi theo, đổi lúc đó
  // là viết lại một chuyện đã xảy ra (BE ném MATCH_015).
  //
  // Huỷ: trận huỷ không còn hiện trên lịch, nên huỷ một buổi ĐÃ ĐÁ là xoá mất dấu vết của buổi
  // đó — cả danh sách người đi lẫn lịch sử đăng ký vẫn còn trong DB nhưng không còn đường nào
  // đi tới. Huỷ là để nói "buổi này sẽ không diễn ra", không phải để dọn quá khứ (BE: MATCH_016).
  const canEdit = isOwner && match.status === "open" && matchPhase(match, now) === "upcoming"

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
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
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(match.startAt)}</p>
            </div>

            {canEdit ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil aria-hidden="true" />
                  Sửa
                </Button>
                <Button type="button" variant="outline" onClick={() => setCancelOpen(true)}>
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
          {/* Nút lịch sử đứng cạnh ĐÚNG danh sách nó dùng để đối chiếu: người ta mở nó ra để so
              với những cái tên đang hiện ở đây ("sao thiếu người này?"), nên đặt ở đâu khác là
              bắt đi tìm. */}
          <div className="mb-2 flex items-center gap-2">
            <h2 className="min-w-0 flex-1 text-sm font-semibold">
              {settlement ? "Người tham gia và tiền phải trả" : "Người tham gia"} (
              {match.playerCount})
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden="true" />
              Xem lịch sử
            </Button>
          </div>
          <ParticipantList
            participants={match.participants}
            currentUserId={currentUserId}
            charges={settlement?.charges}
          />
        </section>

        <SettlementSection match={match} isOwner={isOwner} currentUserId={currentUserId} />
      </div>

      <VoteHistoryDialog matchId={match.id} open={historyOpen} onOpenChange={setHistoryOpen} />

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
