"use client"

import { useNow } from "@/hooks/use-now"
import { useAuthStore } from "@/stores/auth-store"

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

/**
 * Input: giờ trong ngày (0-23).
 * Output: Lời chào theo buổi.
 *
 *         Bốn buổi theo cách người Việt chia ngày, không phải ba buổi kiểu "morning/afternoon/
 *         evening": 11h vẫn là buổi sáng và 22h vẫn là buổi tối, nhưng 13h thì đã là chiều.
 */
function greetingOf(hour: number): string {
  if (hour < 11) return "Chào buổi sáng"
  if (hour < 13) return "Chào buổi trưa"
  if (hour < 18) return "Chào buổi chiều"
  return "Chào buổi tối"
}

/**
 * Input: Không nhận props — tên người lấy từ store phiên đăng nhập.
 * Output: Lời chào mở đầu trang chủ, kèm ngày hôm nay.
 *
 *         Gọi bằng TÊN chứ không phải email: đây là câu đầu tiên của trang, mà một địa chỉ
 *         email thì không phải cách người ta chào nhau. Chưa khai tên (hiếm — onboarding có
 *         hỏi) thì lùi về chào trống, không lấy email ra thay.
 *
 *         Chào bằng ĐỦ họ tên, đúng như user đã khai ở onboarding — không tự cắt lấy tên gọi:
 *         tên người Việt cắt bằng khoảng trắng không phải lúc nào cũng ra đúng chỗ, và một cái
 *         tên bị cắt sai trong câu chào đầu trang là thứ đập vào mắt ngay.
 *
 *         Ngày hôm nay đứng ngay dưới vì cả trang này nói về thời gian ("buổi sắp tới", "7 ngày
 *         tới") — biết hôm nay là thứ mấy thì mấy cái mốc đó mới có chỗ để neo vào.
 */
export function HomeGreeting() {
  const fullName = useAuthStore((state) => state.user?.user.fullName)
  const now = useNow()
  const today = new Date(now)

  const name = fullName?.trim()
  const greeting = greetingOf(today.getHours())

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {name ? `${greeting}, ${name}` : greeting} 👋
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground first-letter:uppercase">
        {dateFormatter.format(today)}
      </p>
    </div>
  )
}
