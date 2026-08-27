"use client"

import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Input: Giá trị đang gõ + hàm nhận giá trị mới.
 * Output: Ô tìm kiếm có icon kính lúp bên trái, và nút xoá bên phải khi đã gõ gì đó.
 *
 *         Chép từ hub (components/globals/search-input.tsx), thêm nút xoá: hub reset bằng cách
 *         xoá tay, còn ở đây danh sách ngắn nên "xem lại toàn bộ" là việc hay làm.
 *
 *         `value` là giá trị TỨC THÌ (chưa debounce) — ô nhập phải phản hồi ngay từng ký tự,
 *         việc chờ là của phía gọi API (xem useTableSearch).
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm",
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full max-w-xs", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange("")}
          aria-label="Xoá từ khoá"
          className="absolute top-1/2 right-1 -translate-y-1/2"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
