import { cn } from "@/lib/utils"

/**
 * Khung xám nhấp nháy giữ chỗ trong lúc chờ dữ liệu. Bản chuẩn của shadcn, giống hệt hub
 * (packages/ui/src/components/skeleton.tsx).
 *
 * Dùng cho những chỗ đã biết TRƯỚC hình dạng của thứ sắp hiện (một con số, một dòng chữ): khung
 * đúng kích thước thì lúc số về không có gì nhảy. Chỗ chưa biết hình dạng thì dùng `Spinner`.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
