import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Input: icon + câu tiêu đề + một câu giải thích.
 * Output: Khối "chỗ này đang trống", dùng chung cho mọi danh sách buổi đá.
 *
 *         Viền ĐỨT chứ không liền: một thẻ viền liền trông như một mục có thật đang chờ tải,
 *         còn viền đứt thì đọc ngay ra là một chỗ chưa có gì. Nền cũng nhạt hơn `bg-card` một
 *         nấc (`bg-muted/30`) để nó lùi ra sau chứ không cạnh tranh với các thẻ thật.
 *
 *         Cùng công thức icon với màn "chưa thuộc tổ chức nào"
 *         (`app/(private)/_components/organization-empty-state.tsx`): ô 48px bo tròn, nền
 *         `primary/10`. Hai màn trống của app vì vậy trông là một nhà.
 *
 *         Đúng MỘT câu dưới tiêu đề, và KHÔNG có nút: mọi thao tác đã nằm ở hàng tiêu đề ngay
 *         phía trên (nút "Tạo lịch", thanh lọc), nên một nút nữa ở đây chỉ là đích bấm thứ hai
 *         cho cùng một việc.
 */
export function MatchEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </div>

      <p className="mt-4 text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
