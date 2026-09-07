import {
  MATCH_ATTENDANCE_LABELS,
  MATCH_ATTENDANCE_SWATCH_CLASS,
  MATCH_ATTENDANCES,
} from "@/lib/match-attendance"
import { cn } from "@/lib/utils"

/**
 * Input: Không nhận props.
 * Output: Ba ô màu + nhãn, giải nghĩa nền chip trên lưới.
 *
 *         Bắt buộc phải có chứ không phải trang trí: nền đặc/rỗng/xám là một quy ước, mà quy
 *         ước không nói ra thì lần đầu nhìn vào nó chỉ là "mấy ô màu khác nhau". Ba dòng chữ
 *         một lần, đổi lại là không phải in "Bạn đã đăng ký" lên từng chip.
 *
 *         Ô màu chép đúng ba kiểu nền của chip (`MATCH_ATTENDANCE_SWATCH_CLASS` nằm cạnh
 *         `MATCH_ATTENDANCE_EVENT_CLASS` trong cùng một file, để sửa nền chip là thấy ngay
 *         phải sửa cả ô chú giải).
 */
export function MatchAttendanceLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {MATCH_ATTENDANCES.map((attendance) => (
        <li key={attendance} className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-xs border",
              MATCH_ATTENDANCE_SWATCH_CLASS[attendance],
            )}
            aria-hidden="true"
          />
          {MATCH_ATTENDANCE_LABELS[attendance]}
        </li>
      ))}
    </ul>
  )
}
