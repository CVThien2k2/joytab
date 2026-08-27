"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

/** Tên cookie ghi nhớ sidebar đang mở hay đang thu. Giá trị: "1" / "0". */
export const SIDEBAR_COOKIE = "sb"

/** Một năm — thu/mở sidebar là thói quen dài hạn, không phải trạng thái của một phiên. */
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

type SidebarContextValue = {
  open: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/**
 * Input: `initialOpen` do layout đọc từ cookie (server) + children.
 * Output: Wrapper mang `data-sidebar="open" | "closed"` cho cả khung — cột sidebar co/giãn
 *         hoàn toàn bằng CSS (`group-data-[sidebar=closed]`) nên `<aside>` và header vẫn là
 *         server component, chỉ provider và nút toggle cần JS.
 *
 *         Ghi cookie bằng `document.cookie` chứ không server action: đây là sở thích hiển thị
 *         nên không cần httpOnly, và ghi ở client thì bấm là thu ngay, không chờ round-trip.
 *         Vẫn là cookie (không phải localStorage) vì layout cần đọc được lúc render trên
 *         server — nhờ vậy lần vào sau không nháy cảnh mở rồi mới thu lại.
 */
export function SidebarProvider({
  initialOpen,
  children,
}: {
  initialOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(initialOpen)

  function toggle(): void {
    setOpen((current) => {
      const next = !current
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`
      return next
    })
  }

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      <div data-sidebar={open ? "open" : "closed"} className="group/sidebar flex min-h-0 flex-1">
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

/**
 * Input: Không nhận tham số.
 * Output: Trạng thái sidebar + hàm thu/mở. Gọi ngoài provider là lỗi lập trình nên ném luôn.
 */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) throw new Error("useSidebar phải được dùng bên trong SidebarProvider")

  return context
}
