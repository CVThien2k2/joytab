"use client"

import { MonitorSmartphone, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"

/** Ba lựa chọn giao diện, khớp `enableSystem` của ThemeProvider ở app/layout.tsx. */
const THEME_OPTIONS = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo hệ thống", icon: MonitorSmartphone },
] as const

/**
 * Input: Không nhận props.
 * Output: Khu chọn giao diện: ba nút Sáng / Tối / Theo hệ thống, cái đang chọn có viền.
 *
 *         Cũng có trong menu tài khoản ở sidebar, nhưng đặt thêm ở đây là có lý: menu kia để đổi
 *         nhanh khi đang làm việc khác, còn đây là chỗ người ta VÀO để xem mình đang cài gì —
 *         một submenu phải hover mới thấy thì không trả lời được câu hỏi đó.
 *
 *         Ba nút hiện luôn chứ không gói vào dropdown: chỉ có ba lựa chọn, mà đây là trang cài
 *         đặt nên thấy hết cùng lúc mới so sánh được.
 *
 *         `useMounted` là bắt buộc: `theme` của next-themes chỉ có giá trị thật ở client, tô nút
 *         ngay lúc render server sẽ lệch hydrate. Trước khi mounted thì không nút nào được tô —
 *         một nhịp rất ngắn, đổi lại không có cảnh nút nhảy từ cái này sang cái khác.
 */
export function ThemeSetting() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const current = mounted ? (theme ?? "system") : null

  return (
    <section className="p-4">
      <h2 className="text-sm font-semibold">Giao diện</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Áp dụng cho thiết bị này. &ldquo;Theo hệ thống&rdquo; là đi theo cài đặt sáng/tối của máy.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Chọn giao diện">
        {THEME_OPTIONS.map((option) => {
          const isActive = current === option.value
          const Icon = option.icon

          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={isActive ? "outline" : "ghost"}
              aria-pressed={isActive}
              onClick={() => setTheme(option.value)}
              className={cn(isActive && "border-primary/40 text-foreground")}
            >
              <Icon
                className={cn(isActive ? "text-primary" : "text-muted-foreground")}
                aria-hidden="true"
              />
              {option.label}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
