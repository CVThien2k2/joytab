"use client"

import { useAuthStore } from "@/providers/auth-store-provider"

/**
 * Input: Không nhận props; đọc user từ store (layout đã bơm vào).
 * Output: In nguyên JSON user. Cố tình không dựng UI gì thêm.
 */
export default function HomePage() {
  const user = useAuthStore((state) => state.user)

  return (
    <main className="p-6">
      <pre className="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(user, null, 2)}</pre>
    </main>
  )
}
