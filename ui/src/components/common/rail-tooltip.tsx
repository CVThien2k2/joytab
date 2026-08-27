"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Input: Nhãn cần hiện, cờ bật/tắt, và phần tử được bọc.
 * Output: Bọc phần tử bằng tooltip bên phải — CHỈ khi sidebar đang thu gọn, vì lúc đó nhãn chữ
 *         đã ẩn nên cái icon trơ ra không tự nói được nó là gì.
 *
 *         Tắt thì trả thẳng children, không render Tooltip: mở rộng mà vẫn bọc thì hover vào
 *         nav nào cũng bung ra một cái nhãn lặp lại đúng chữ đang nằm ngay cạnh nó.
 *
 *         Lấy nguyên ý từ hub (components/sidebar/rail-tooltip.tsx).
 */
export function RailTooltip({
  label,
  enabled,
  children,
}: {
  label: string
  enabled: boolean
  children: React.ReactNode
}) {
  if (!enabled) return <>{children}</>

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
