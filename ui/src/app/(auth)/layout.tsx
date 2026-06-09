"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMe } from "@/hooks/use-auth-api"
import { AuthHeader } from "./_components/auth-header"

/**
 * Input: Nội dung các route auth (login).
 * Output: Client Component (CSR). Nếu useMe trả user hợp lệ → đã đăng nhập → đá về `/`.
 *         Chưa đăng nhập / hết phiên (useMe lỗi) → cho ở lại để đăng nhập.
 *         Thêm tài khoản đi thẳng OAuth (/auth/google), không qua route này.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const { data: user } = useMe()

  useEffect(() => {
    if (user) {
      router.replace("/")
    }
  }, [user, router])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthHeader />
      {children}
    </div>
  )
}
