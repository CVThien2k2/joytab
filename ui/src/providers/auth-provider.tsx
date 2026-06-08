"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useAuthStore } from "@/stores/auth-store"
import type { CurrentUser } from "@/types/auth"

type AuthProviderProps = {
  /** User lấy từ server ở root layout (null nếu chưa đăng nhập). */
  user: CurrentUser | null
  children: ReactNode
}

/**
 * Input: user từ server + children (bọc toàn bộ app ở root layout).
 * Output: Hydrate user vào store cho cả app dùng. Set đồng bộ lần đầu qua initializer của useState
 *         (tránh flash), sync lại khi prop đổi (vd sau router.refresh đổi account/đăng xuất).
 */
export function AuthProvider({ user, children }: AuthProviderProps) {
  useState(() => {
    useAuthStore.setState({ user })
    return null
  })
  useEffect(() => {
    useAuthStore.setState({ user })
  }, [user])

  return children
}
