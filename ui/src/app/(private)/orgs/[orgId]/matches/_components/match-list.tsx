"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useNow } from "@/hooks/use-now"
import { formatDateTime, formatMoney, formatTimeRange } from "@/lib/format"
import type { MatchSummary } from "@/types/match"

/** Nhãn trạng thái của một trận, nhìn từ người đang xem danh sách. */
function statusBadge(match: MatchSummary) {
  if (match.status === "canceled") return <Badge variant="destructive">Đã huỷ</Badge>
  if (match.status === "settled") return <Badge variant="secondary">Đã chốt tiền</Badge>
  if (match.voteClosedReason === "started") return <Badge variant="outline">Đã diễn ra</Badge>
  if (match.voteClosedReason === "full") return <Badge variant="outline">Đủ người</Badge>
  return <Badge>Đang mở đăng ký</Badge>
}

/**
 * Input: danh sách trận trong khoảng đang xem + id tổ chức.
 * Output: Danh sách dạng bảng, sắp tới trước rồi tới đã qua.
 *
 *         Có mặt bên cạnh bộ lịch vì hai cách đọc khác nhau: lịch trả lời "tuần này có gì",
 *         danh sách trả lời "trận nào tôi còn nợ tiền, trận nào chưa đủ người". Câu thứ hai
 *         quét bằng mắt trên một cột thì nhanh hơn nhiều so với rê khắp lưới.
 */
export function MatchList({
  matches,
  organizationId,
}: {
  matches: MatchSummary[]
  organizationId: string
}) {
  const now = useNow()
  const upcoming = matches.filter((match) => new Date(match.startAt).getTime() >= now)
  const past = matches
    .filter((match) => new Date(match.startAt).getTime() < now)
    .slice()
    .reverse()

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Chưa có trận nào trong khoảng thời gian này.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Section title="Sắp tới" matches={upcoming} organizationId={organizationId} />
      <Section title="Đã qua" matches={past} organizationId={organizationId} />
    </div>
  )
}

function Section({
  title,
  matches,
  organizationId,
}: {
  title: string
  matches: MatchSummary[]
  organizationId: string
}) {
  if (matches.length === 0) return null

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {matches.map((match) => (
          <li key={match.id}>
            <Link
              href={`/orgs/${organizationId}/matches/${match.id}`}
              className="flex flex-wrap items-center gap-3 p-4 outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{match.courtName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(match.startAt)} · {formatTimeRange(match.startAt, match.endAt)}
                </p>
              </div>

              {match.voted ? <Badge variant="outline">Bạn đã đăng ký</Badge> : null}
              {match.myAmount !== null ? (
                <Badge variant={match.myPaymentStatus === "unpaid" ? "destructive" : "secondary"}>
                  {formatMoney(match.myAmount)}đ
                </Badge>
              ) : null}
              {statusBadge(match)}

              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {match.playerCount}/{match.maxPlayers}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
