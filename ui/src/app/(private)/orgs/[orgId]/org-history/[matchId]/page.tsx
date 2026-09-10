"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { CalendarDays, History, MapPin, Users } from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useMatch, useSettlement } from "@/hooks/use-matches-api"
import { formatDateTime, formatTimeRange } from "@/lib/format"
import { organizationHomePath } from "@/lib/routes"
import { useAuthStore } from "@/stores/auth-store"
import { useActiveOrganization } from "@/stores/organization-store"
import { ParticipantList } from "./_components/participant-list"
import { SettlementSection } from "./_components/settlement-section"
import { VoteHistoryDialog } from "./_components/vote-history-dialog"

/**
 * Input: `matchId` trên URL.
 * Output: Trang chi tiết một buổi đã qua: thông tin, ai có mặt và phải trả bao nhiêu, rồi chi
 *         phí — với đúng MỘT việc làm được ở đây là chốt giá.
 *
 *         Là trang con của Lịch sử tổ chức, và đó cũng là lối vào duy nhất. Vì vậy nó chỉ còn
 *         phục vụ một câu hỏi: "buổi này chốt giá chưa, ai chưa trả". Mọi thứ thuộc về lúc
 *         buổi CHƯA diễn ra đã bỏ khỏi đây:
 *
 *          - đăng ký / huỷ đăng ký: việc của trang chủ, nơi liệt kê buổi sắp tới;
 *          - sửa giờ / huỷ trận: chỉ làm được khi chưa tới giờ, mà sổ lịch sử thì toàn buổi đã
 *            qua — hai nút không bao giờ bật được là hai nút không nên có;
 *          - trả tiền: người trả đi từ "Trận của tôi" hoặc dải nhắc nợ, không phải từ đây —
 *            trang này nhìn từ vai người đi THU;
 *          - sửa lại bảng chia tiền: chốt giá là một lần, không phải một ô sửa được mãi.
 *
 *         Còn lại một mạch dọc đọc từ trên xuống: buổi này là buổi nào → ai có mặt và nợ bao
 *         nhiêu → hết bao nhiêu tiền.
 *
 *         CHỈ owner vào được, cùng khuôn với trang cha: sau khi bỏ đăng ký và trả tiền thì
 *         member vào đây không còn việc nào làm được, mà bảng tiền của cả buổi lại là chuyện
 *         của người đi thu.
 */
export default function MatchDetailPage() {
  const params = useParams<{ orgId: string; matchId: string }>()
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"
  const currentUserId = useAuthStore((state) => state.user?.userId) ?? ""

  const { data: match, isPending, isError } = useMatch(params.matchId)
  // Cùng query key với khu chi phí nên React Query chỉ gọi MỘT lần; trang cần nó để dán tiền
  // vào đúng dòng người tham gia.
  const { data: settlement } = useSettlement(params.matchId, match?.status === "settled")
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (!isOwner) router.replace(organizationHomePath(organization.id))
  }, [isOwner, organization.id, router])

  // Không render gì trong lúc chờ effect đá đi: loé lên bảng tiền của cả buổi rồi mới chuyển
  // trang thì đúng cái cần giấu lại là cái người ta kịp đọc.
  if (!isOwner) return null

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
          <Link href={organizationHomePath(organization.id)}>Về trang chủ</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-4">
          {/* Nhãn trạng thái ĐẦY ĐỦ, dùng chung `MatchStatusBadge` với thẻ trận ở danh sách:
              hai chỗ gọi tên cùng một trận theo hai kiểu là chỗ người ta bắt đầu không tin cái
              đang hiện. */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{match.courtName}</h1>
            <MatchStatusBadge match={match} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(match.startAt)}</p>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            {/* Ô này nói ĐỊA CHỈ — thứ duy nhất người ta cần copy ra bản đồ — và chỉ lùi về tên
                sân khi trận được tạo từ trước lúc có ô địa chỉ. */}
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{match.address ?? match.courtName}</span>
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

        <section>
          {/* Nút lịch sử đứng cạnh ĐÚNG danh sách nó dùng để đối chiếu: người ta mở nó ra để so
              với những cái tên đang hiện ở đây ("sao thiếu người này?") trước khi chốt giá, nên
              đặt ở đâu khác là bắt đi tìm. Nó chỉ ĐỌC — không sửa được gì. */}
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
            organizationId={organization.id}
            matchId={match.id}
            participants={match.participants}
            currentUserId={currentUserId}
            charges={settlement?.charges}
          />
        </section>

        <SettlementSection match={match} />
      </div>

      <VoteHistoryDialog matchId={match.id} open={historyOpen} onOpenChange={setHistoryOpen} />
    </main>
  )
}
