"use client"

import { MonitorSmartphone, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
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
 * Output: Khu chọn giao diện: nhãn bên trái, ba lựa chọn Sáng / Tối / Theo hệ thống bên phải,
 *         dựng thành segmented control — cả cụm nằm trên một rãnh nền chìm, cái đang chọn nổi
 *         lên thành thẻ nền sáng có đổ bóng.
 *
 *         Trước đây phân biệt bằng `variant` outline với ghost, tức là chỉ hơn nhau một đường
 *         viền mờ — nhìn lướt không ra đang chọn cái nào. Ở đây tương phản là NỀN chứ không phải
 *         viền: nổi/chìm đọc được ngay cả khi liếc qua, và không cần mượn màu nhấn.
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
    <section className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">Giao diện</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Áp dụng cho thiết bị này. &ldquo;Theo hệ thống&rdquo; là đi theo cài đặt sáng/tối của máy.
        </p>
      </div>

      {/* Nhãn trái, nút phải: ba nút xếp dưới nhãn thì khối cao ba dòng và cả nửa phải bỏ trống.
          `flex-wrap` để màn hẹp vẫn xuống dòng thay vì bóp nút. */}
      <div
        className="inline-flex shrink-0 flex-wrap gap-1 rounded-lg bg-muted p-1"
        role="group"
        aria-label="Chọn giao diện"
      >
        {THEME_OPTIONS.map((option) => {
          const isActive = current === option.value
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setTheme(option.value)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* Icon đi theo màu chữ của chính nút — trạng thái đã nói bằng nền, thêm một màu
                  riêng cho icon là nói hai lần. */}
              <Icon className="size-4 shrink-0 text-current" aria-hidden="true" />
              {option.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
