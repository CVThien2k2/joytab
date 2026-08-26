import { cn } from "@/lib/utils"

const BARS = Array.from({ length: 12 })

/**
 * Spinner 12 vạch mờ dần quay tròn (kiểu "quay dồn") — dùng `currentColor` nên
 * đổi màu qua class `text-*`, đổi cỡ qua `size-*`.
 *
 * Giữ nguyên hình dạng với Spinner của hub để hai sản phẩm nhìn như một nhà.
 * Không dùng `Loader2` của lucide: nó là vòng tròn hở, khác hẳn về cảm giác.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      role="status"
      aria-label="Đang tải"
      viewBox="0 0 24 24"
      className={cn("size-5 animate-spin", className)}
    >
      {BARS.map((_, i) => (
        <rect
          key={i}
          x="11"
          y="2"
          width="2"
          height="5.5"
          rx="1"
          fill="currentColor"
          opacity={(i + 1) / BARS.length}
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
    </svg>
  )
}
