import { cn } from "@/lib/utils"

const BARS = Array.from({ length: 12 })

/**
 * Input: className để đổi cỡ (`size-*`) và màu (`text-*`).
 * Output: Spinner 12 vạch mờ dần quay tròn, vẽ bằng `currentColor` — cùng một icon load với
 *         hub để hai app nhìn như một nhà.
 *
 *         CỐ TÌNH khác bản registry của shadcn (bản đó là `Loader2Icon` của lucide): chạy
 *         `shadcn add spinner` sẽ ghi đè file này, nhớ chép lại.
 *
 *         Giữ `size-4` mặc định (hub để size-5) vì Button ở đây canh icon 16px — spinner to
 *         hơn icon thường sẽ làm nút giật khi đổi qua lại.
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label="Đang tải"
      viewBox="0 0 24 24"
      className={cn("size-4 animate-spin", className)}
      {...props}
    >
      {BARS.map((_, index) => (
        <rect
          key={index}
          x="11"
          y="2"
          width="2"
          height="5.5"
          rx="1"
          fill="currentColor"
          opacity={(index + 1) / BARS.length}
          transform={`rotate(${index * 30} 12 12)`}
        />
      ))}
    </svg>
  )
}

export { Spinner }
