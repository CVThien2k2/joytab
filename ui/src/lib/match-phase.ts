import { MATCH_CANCEL_LOCK_HOURS } from "@/schema/match"
import type { VoteClosedReason } from "@/types/match"

/**
 * Giai đoạn của một trận theo mốc "bây giờ".
 *
 * BE chỉ nói "vote đã đóng vì `started`", tức là đã qua giờ bắt đầu — nhưng "đang đá" và "đá
 * xong rồi" là hai chuyện khác nhau với người đọc: một cái còn đang diễn ra, một cái đã là
 * quá khứ. Cùng gọi là "đã diễn ra" thì lịch tuần hiện một trận 19h-21h là "đã diễn ra" ngay
 * lúc 19h05, trong khi mọi người vẫn đang ở sân.
 *
 * Suy ra ở FE chứ không thêm cột ở BE: nó là hàm của [start_at, end_at) và thời gian, mà thời
 * gian thì không có cột nào giữ được.
 */
export type MatchPhase = "upcoming" | "ongoing" | "ended"

/**
 * Nhãn của ba giai đoạn. MỘT bộ duy nhất, dùng cho cả chip trên lịch lẫn `MatchStatusBadge`:
 * cùng một trận mà hai màn hình gọi tên khác nhau là chỗ người ta bắt đầu không tin cái đang
 * hiện.
 */
export const MATCH_PHASE_LABELS: Record<MatchPhase, string> = {
  upcoming: "Chưa diễn ra",
  ongoing: "Đang diễn ra",
  ended: "Đã kết thúc",
}

/**
 * Input: một trận (chỉ cần hai mốc giờ) + mốc "bây giờ" (ms).
 * Output: Giai đoạn của nó.
 *
 *         Biên nửa mở [start, end) — cùng quy ước với `overlaps` ở BE: đúng lúc `end_at` là đã
 *         kết thúc, không phải vẫn còn đang đá.
 */
export function matchPhase(match: { startAt: string; endAt: string }, now: number): MatchPhase {
  if (new Date(match.endAt).getTime() <= now) return "ended"
  if (new Date(match.startAt).getTime() <= now) return "ongoing"
  return "upcoming"
}

/**
 * Input: lý do vote đang đóng + giai đoạn của trận.
 * Output: Câu giải thích cho người chưa đăng ký, hoặc `null` nếu vote vẫn đang mở.
 *
 *         Luôn NÓI RA lý do thay vì chỉ làm mờ nút: nút mờ không giải thích được là "hết chỗ"
 *         hay "đã tới giờ", mà hai chuyện đó dẫn tới hai hành động khác nhau.
 *
 *         Khai ở đây chứ không ở từng chỗ dùng: thẻ hover trên lịch và khối vote ở trang chi
 *         tiết nói về CÙNG một trận, mà hai bản sao của cùng một câu thì sẽ có lúc lệch nhau.
 */
export function voteClosedText(reason: VoteClosedReason, phase: MatchPhase): string | null {
  if (reason === "full") return "Trận đã đủ người."
  if (reason === "started") {
    return phase === "ended"
      ? "Trận đã kết thúc nên không đăng ký được nữa."
      : "Trận đang diễn ra nên không đăng ký được nữa."
  }
  if (reason === "canceled") return "Trận đã bị huỷ."
  return null
}

/**
 * Input: lý do vote đang đóng + giai đoạn của trận.
 * Output: Câu giải thích cho người ĐÃ đăng ký mà không rút ra được nữa.
 *
 *         Hai lý do khác nhau hẳn: đã tới giờ (không làm gì được nữa) và còn trong cửa khoá 2
 *         tiếng trước giờ chơi (vẫn còn kịp nếu đi được).
 */
export function cancelLockedText(reason: VoteClosedReason, phase: MatchPhase): string {
  if (reason === "started") {
    return phase === "ended" ? "Trận đã kết thúc." : "Trận đang diễn ra."
  }
  return `Không huỷ được khi còn dưới ${MATCH_CANCEL_LOCK_HOURS} tiếng nữa là tới giờ chơi.`
}
