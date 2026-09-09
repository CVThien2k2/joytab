import { Check } from "lucide-react"
import { MATCH_PHASE_LABELS, MATCH_PHASE_SWATCH_CLASS, MATCH_PHASES } from "@/lib/match-phase"
import { cn } from "@/lib/utils"

export type MatchPhaseLegendProps = {
  className?: string
}

/**
 * Input: `className` để chỗ gọi ghép thêm ẩn/hiện theo breakpoint.
 * Output: Bốn mục chú giải dưới lịch — ba nền giai đoạn, rồi huy hiệu "đã tham gia".
 *
 *         Bắt buộc phải có TRÊN LƯỚI, không phải trang trí: chip không in ra chữ nào nói mình
 *         đã đăng ký hay chưa, cả thông tin đó nằm trong một huy hiệu 18px ở góc. Bỏ chú giải đi
 *         thì lưới chỉ còn mấy mảng màu và mấy cái icon nhỏ mà không ai biết chúng nói gì.
 *
 *         Mobile không dùng lưới nên KHÔNG cần bản này: agenda (components/common/match-agenda)
 *         đã tự nói trạng thái bằng chữ qua `MatchStatusBadge` trên từng thẻ, chú giải màu ở đó
 *         là thông tin thừa — chỗ gọi tự ẩn bằng `hidden md:flex` qua `className`.
 *
 *         Ô màu dùng LẠI đúng class của chip (`MATCH_PHASE_SWATCH_CLASS` trỏ vào cùng những
 *         class mà `eventClass` gán), nên không có bản màu thứ hai để trôi lệch — sửa nền chip
 *         là ô chú giải đổi theo cùng lúc.
 *
 *         Mục thứ tư khác ba mục đầu: nó không phải một ô màu mà là chính cái huy hiệu, thu nhỏ.
 *         Chép hình dạng chứ không chép màu — người ta tìm nó bằng hình tròn có dấu tích, không
 *         phải bằng sắc độ.
 */
export function MatchPhaseLegend({ className }: MatchPhaseLegendProps) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-1", className)}>
      {MATCH_PHASES.map((phase) => (
        <li key={phase} className="flex items-center gap-1.5">
          <span
            className={cn("size-2.5 shrink-0 rounded-xs border", MATCH_PHASE_SWATCH_CLASS[phase])}
            aria-hidden="true"
          />
          {MATCH_PHASE_LABELS[phase]}
        </li>
      ))}

      <li className="flex items-center gap-1.5">
        <span
          className="grid size-3.5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Check className="size-2" strokeWidth={3.5} />
        </span>
        Đã tham gia
      </li>
    </ul>
  )
}
