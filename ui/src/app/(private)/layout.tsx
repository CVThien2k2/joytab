"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useMe } from "@/hooks/use-auth-api"

/**
 * Input: Nội dung các route private cần đăng nhập trong App Router.
 * Output: Gate bằng /auth/me (cookie session). Đang tải → null; 401 → điều hướng /login; có user → render.
 */
export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const meQuery = useMe()

  useEffect(() => {
    if (meQuery.isError) router.replace("/login")
  }, [meQuery.isError, router])

  if (meQuery.isPending || meQuery.isError) return null
  return children
}
