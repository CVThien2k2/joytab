import { Badge } from "@/components/ui/badge"
import type { MatchSummary } from "@/types/match"

/**
 * Input: một trận.
 * Output: Nhãn trạng thái, nhìn từ người đang xem.
 *
 *         Dùng chung cho danh sách và thẻ hover trên lịch: cùng một trận mà hai màn hình gọi
 *         tên khác nhau là chỗ người ta bắt đầu không tin cái đang hiện.
 *
 *         Thứ tự các nhánh là thứ tự ưu tiên: đã huỷ / đã chốt tiền là chuyện của TRẬN, còn
 *         đủ người / đã diễn ra chỉ là chuyện của Ô ĐĂNG KÝ — trận huỷ mà hiện "đủ người" thì
 *         nói đúng một nửa và nửa sai lại là nửa người ta hành động theo.
 */
export function MatchStatusBadge({ match }: { match: MatchSummary }) {
  if (match.status === "canceled") return <Badge variant="destructive">Đã huỷ</Badge>
  if (match.status === "settled") return <Badge variant="secondary">Đã chốt tiền</Badge>
  if (match.voteClosedReason === "started") return <Badge variant="outline">Đã diễn ra</Badge>
  if (match.voteClosedReason === "full") return <Badge variant="outline">Đủ người</Badge>
  return <Badge>Đang mở đăng ký</Badge>
}
