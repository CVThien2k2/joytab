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

/** Thứ tự đọc của chú giải: có mặt → còn kịp → hết cửa. */
export const MATCH_ATTENDANCES = ["joined", "open", "closed"] as const

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

/** Nhãn của chú giải dưới lịch. Nói ra cả hai nửa: "mình" và "cửa đăng ký". */
export const MATCH_ATTENDANCE_LABELS: Record<MatchAttendance, string> = {
  joined: "Bạn đã đăng ký",
  open: "Chưa đăng ký, còn mở",
  closed: "Đã đóng đăng ký",
}

/**
 * Nền chip trên lưới, theo cặp ĐẶC / RỖNG / XÁM.
 *
 * Trước đây mọi chip cùng một màu `primary` đặc, nên nhìn cả tuần không biết buổi nào mình có
 * mặt — phải rê chuột vào từng cái mới thấy dòng "Bạn đã đăng ký" trong thẻ xem nhanh.
 *
 * Chọn ĐỘ ĐẶC chứ không chọn màu khác nhau, vì hai lý do: chip cao chưa tới 60px không còn chỗ
 * cho một dòng chữ nữa, và màu thì đã có nhãn giai đoạn dùng rồi — thêm một thang màu thứ hai
 * lên cùng một chip là hai bảng màu phải học thuộc. Đặc/rỗng đọc được ngay cả khi liếc qua và
 * cả khi người xem không phân biệt được màu.
 *
 * Viền đứt cho `open` là chủ ý: một khối viền đứt đọc ra là "chỗ này còn trống", đúng nghĩa
 * "bạn chưa có trong đây".
 *
 * `!` vì theme tô nền event bằng lớp pha nhạt từ `--fc-event-color` — đây là chuyện của app,
 * không phải của theme (xem chú thích đầu `match-calendar-view.tsx`).
 */
export const MATCH_ATTENDANCE_EVENT_CLASS: Record<MatchAttendance, string> = {
  joined: "bg-primary! text-primary-foreground! border-primary!",
  open: "bg-primary/10! dark:bg-primary/20! text-foreground! border-primary! border-dashed!",
  closed: "bg-muted! text-muted-foreground! border-border!",
}

/** Ô màu trong chú giải. Cùng ba kiểu nền với chip, bỏ `!` vì ở đây không có theme để cãi. */
export const MATCH_ATTENDANCE_SWATCH_CLASS: Record<MatchAttendance, string> = {
  joined: "bg-primary border-primary",
  open: "bg-primary/10 dark:bg-primary/20 border-primary border-dashed",
  closed: "bg-muted border-border",
}
