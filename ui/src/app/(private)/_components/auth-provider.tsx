"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import type { CurrentUser } from "@/types/auth"

/**
 * Input: user lấy từ server ở (private)/layout + children.
 * Output: Hydrate user vào store để FE dùng. Set đồng bộ lần đầu qua initializer của useState
 *         (chạy đúng 1 lần, tránh flash null), sync lại khi prop đổi (vd sau router.refresh).
 */
export function AuthProvider({
  user,
  children,
}: Readonly<{ user: CurrentUser; children: React.ReactNode }>) {
  useState(() => {
    useAuthStore.setState({ user })
    return null
  })
  useEffect(() => {
    useAuthStore.setState({ user })
  }, [user])

  return children
}
