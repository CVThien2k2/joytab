import type { ReactNode } from "react"
import { ProtectedHeader } from "./protected-header"

/**
 * Input: Children React của các trang yêu cầu đã đăng nhập.
 * Output: Render shell có header (user + logout) và nội dung chính cho khu vực protected.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <ProtectedHeader />
      <main className="flex flex-1 flex-col p-6">{children}</main>
    </div>
  )
}
