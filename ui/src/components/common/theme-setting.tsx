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
 * Output: Khu chọn giao diện: nhãn ở trên, ba lựa chọn Sáng / Tối / Theo hệ thống trải hết bề
 *         ngang bên dưới, dựng thành segmented control — cả cụm nằm trên một rãnh nền chìm, cái
 *         đang chọn nổi lên thành thẻ nền sáng có đổ bóng.
 *
 *         Trước đây phân biệt bằng `variant` outline với ghost, tức là chỉ hơn nhau một đường
 *         viền mờ — nhìn lướt không ra đang chọn cái nào. Ở đây tương phản là NỀN chứ không phải
 *         viền: nổi/chìm đọc được ngay cả khi liếc qua, và không cần mượn màu nhấn.
 *
 *         Cũng có trong menu tài khoản ở sidebar, nhưng đặt thêm ở đây là có lý: submenu kia để
 *         đổi nhanh khi đang làm việc khác, phải hover mới thấy nên không trả lời được câu "mình
 *         đang cài gì" — còn đây là chỗ người ta MỞ RA để xem đúng câu đó.
 *
 *         Ba nút hiện luôn chứ không gói vào dropdown: chỉ có ba lựa chọn, mà đây là khu cài
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

      {/* Nhãn TRÊN, ba nút trải hết bề ngang bên dưới — không còn xếp nhãn trái / nút phải.
          Trong hộp thoại rộng `max-w-lg`, nửa phải không đủ chỗ cho ba nút có chữ: chúng bị bóp
          lại rồi `flex-wrap` bẻ xuống dòng, thành hai nút một hàng và một nút lạc lõng hàng dưới.
          Trải hết hàng thì ba lựa chọn bằng nhau đúng như ý nghĩa của chúng, và mỗi đích bấm
          rộng gấp đôi — thứ đáng giá nhất trên màn hình điện thoại. */}
      <div
        className="mt-3 flex w-full gap-1 rounded-lg bg-muted p-1"
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
                // `flex-1 basis-0` để ba nút chia đều bề ngang bất kể chữ dài ngắn: không có
                // `basis-0` thì "Theo hệ thống" chiếm phần lớn hơn hẳn hai nút kia.
                "inline-flex h-8 flex-1 basis-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
