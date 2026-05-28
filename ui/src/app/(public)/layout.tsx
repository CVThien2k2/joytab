import type { ReactNode } from "react"

/**
 * Input: Children React cho khu vực guest (login + callback).
 * Output: Render layout center tối giản cho người dùng chưa đăng nhập.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      {children}
    </main>
  )
}
