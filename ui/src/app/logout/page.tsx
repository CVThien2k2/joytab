"use client"

import { useEffect, useRef } from "react"
import { logout } from "@/api/auth"
import { Spinner } from "@/components/ui/spinner"
import { isSafeInternalPath } from "@/lib/redirect"

/**
 * Cờ "vừa bấm đăng xuất" — cookie THƯỜNG (không httpOnly) để proxy đọc được. BE lỗi thì cookie
 * phiên còn nguyên, mà gác cổng lại đá /login về `/` khi còn `rt` → không bao giờ tới được
 * trang đăng nhập. Cờ này là đường tránh, tự hết sau 30 giây nên không kẹt lại trạng thái nào.
 */
const LOGOUT_MARK = "logged_out"

/**
 * Input: `?next=<path>` (tuỳ chọn) — đích muốn tới sau khi đăng nhập lại.
 * Output: Đăng xuất chạy hoàn toàn ở client, hai bước:
 *
 *  1. /auth/logout — BE revoke refresh token và trả Set-Cookie xoá `at`/`rt`/`onb`.
 *  2. /api/session/clear — web tự xoá cookie phiên. Bước 1 hỏng (BE chết, mạng đứt) thì cookie
 *     httpOnly còn nguyên và gác cổng đá mọi lượt vào /login về `/`. Bước này là cửa thoát,
 *     không phụ thuộc BE.
 *
 *         Thứ tự bắt buộc: gọi BE TRƯỚC. Xoá cookie trước là mất `rt`, BE không còn gì để thu
 *         hồi và refresh token sống tới hết hạn.
 *
 *         Cả hai bước hỏng vẫn đi tiếp — chặn người dùng lại ở đây là biến sự cố BE thành kẹt
 *         cứng. Đi bằng `window.location.replace` chứ không `router`: phải nạp lại cả app để
 *         không còn store/cache nào của phiên cũ nằm trong bộ nhớ.
 *
 *         Đây là chỗ DUY NHẤT đăng xuất. Nút "Đăng xuất" ở sidebar chỉ điều hướng tới đây, và
 *         apiClient cũng đưa về đây khi xoay token thất bại.
 *
 *         Đọc `?next=` bằng `window.location` chứ không `useSearchParams()`: hook đó bắt trang
 *         phải có Suspense boundary (bằng không `next build` gãy ở bước prerender), mà ở đây
 *         không cần — giá trị chỉ dùng trong effect, tức là đã ở trên browser.
 */
export default function LogoutPage() {
  // StrictMode gọi effect hai lần; đăng xuất hai lượt thì lượt sau chắc chắn 401.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const next = new URLSearchParams(window.location.search).get("next")
    const target = isSafeInternalPath(next) ? `/login?next=${encodeURIComponent(next)}` : "/login"

    document.cookie = `${LOGOUT_MARK}=1; Path=/; Max-Age=30; SameSite=Lax`

    void logout()
      .catch(() => undefined)
      .then(() => fetch("/api/session/clear", { method: "POST" }))
      .catch(() => undefined)
      .finally(() => window.location.replace(target))
  }, [])

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
        <Spinner className="size-8 text-primary" />
        <p className="text-sm">Đang đăng xuất</p>
      </div>
    </main>
  )
}
