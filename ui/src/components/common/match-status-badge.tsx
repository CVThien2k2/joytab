"use client"

import { Badge } from "@/components/ui/badge"
import { useNow } from "@/hooks/use-now"
import { MATCH_PHASE_LABELS, matchPhase } from "@/lib/match-phase"
import type { MatchSummary } from "@/types/match"

/**
 * Input: một trận.
 * Output: Nhãn trạng thái, nhìn từ người đang xem.
 *
 *         Dùng chung cho mọi chỗ hiện trạng thái một trận: cùng một trận mà hai màn hình gọi
 *         tên khác nhau là chỗ người ta bắt đầu không tin cái đang hiện.
 *
 *         Thứ tự các nhánh là thứ tự ưu tiên: đã huỷ / đã chốt tiền là chuyện của TRẬN, còn
 *         đang diễn ra / đã kết thúc / đủ người chỉ là chuyện của MỘT thời điểm — trận huỷ mà
 *         hiện "đủ người" thì nói đúng một nửa và nửa sai lại là nửa người ta hành động theo.
 *
 *         "Đang diễn ra" và "Đã kết thúc" là hai nhãn, không phải một: BE chỉ nói vote đóng vì
 *         `started`, nhưng lúc 19h05 của một trận 19h-21h thì mọi người vẫn đang ở sân — gọi
 *         nó là "đã diễn ra" là nói sai về hiện tại.
 */
export function MatchStatusBadge({ match }: { match: MatchSummary }) {
  const now = useNow()
  const phase = matchPhase(match, now)

  if (match.status === "canceled") return <Badge variant="destructive">Đã huỷ</Badge>
  if (match.status === "settled") return <Badge variant="secondary">Đã chốt tiền</Badge>
  if (phase === "ended") return <Badge variant="outline">{MATCH_PHASE_LABELS.ended}</Badge>
  if (phase === "ongoing") return <Badge variant="secondary">{MATCH_PHASE_LABELS.ongoing}</Badge>
  if (match.voteClosedReason === "full") return <Badge variant="outline">Đủ người</Badge>
  return <Badge>Đang mở đăng ký</Badge>
}
