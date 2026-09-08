import type { MatchSummary } from "@/types/match"

/**
 * Trạng thái của TÔI với một buổi đá — trục thứ hai, độc lập với `matchPhase`.
 *
 * Hai trục trả lời hai câu khác nhau và cả hai đều cần có mặt trên lưới: giai đoạn nói về
 * TRẬN ("buổi này đã đá chưa"), còn cái này nói về NGƯỜI ĐANG XEM ("mình có trong đó không").
 * Một trận `upcoming` mà mình chưa đăng ký và một trận `upcoming` mà mình đã đăng ký là hai
 * việc hoàn toàn khác nhau phải làm, nên không gộp được vào một thang.
 *
 * - `joined`: đã đăng ký, mình có mặt trong buổi này.
 * - `open`: chưa đăng ký và vote vẫn đang mở — còn kịp, đây là buổi duy nhất cần hành động.
 * - `closed`: chưa đăng ký và không đăng ký được nữa (đủ người / đã tới giờ / đã kết thúc).
 */
export type MatchAttendance = "joined" | "open" | "closed"

/**
 * Input: một trận (chỉ cần `voted` và lý do vote đóng).
 * Output: Trạng thái của người đang xem với trận đó.
 *
 *         KHÔNG cần mốc "bây giờ": `voteClosedReason` của BE đã gộp cả ba lý do đóng, trong đó
 *         `started` phủ luôn cả đang đá lẫn đã đá xong. Tự so giờ ở đây là dựng thêm một bản
 *         sao của luật đóng vote, mà hai bản sao thì sẽ có lúc lệch nhau.
 */
export function matchAttendance(
  match: Pick<MatchSummary, "voted" | "voteClosedReason">,
): MatchAttendance {
  if (match.voted) return "joined"
  return match.voteClosedReason === null ? "open" : "closed"
}

/**
 * Nhãn dạng chữ của ba trạng thái. Dùng cho nhãn `sr-only` trên chip: trạng thái này hiện ra bằng
 * một huy hiệu icon ở góc chip, mà icon thì trình đọc màn hình không đọc được.
 */
export const MATCH_ATTENDANCE_LABELS: Record<MatchAttendance, string> = {
  joined: "Bạn đã đăng ký",
  open: "Chưa đăng ký, còn mở",
  closed: "Đã đóng đăng ký",
}
