"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMe } from "@/hooks/use-auth-api"

/**
 * Input: Nội dung các route private.
 * Output: Client gate (CSR) qua useMe:
 *  - đang tải → loading.
 *  - lỗi (401 hết phiên / không đăng nhập) → redirect /switch-account.
 *  - hợp lệ → render children.
 */
export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const { data: user, isPending, isError } = useMe()

  useEffect(() => {
    if (isError) {
      router.replace("/switch-account?reason=expired")
    }
  }, [isError, router])

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Đang tải…
      </div>
    )
  }
  if (!user) {
    return null
  }
  return children
}
