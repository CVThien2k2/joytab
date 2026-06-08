"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SessionErrorScreen } from "@/components/auth/session-error-screen"
import { SessionExpiredScreen } from "@/components/auth/session-expired-screen"
import { useAuthStore } from "@/stores/auth-store"
import type { CurrentUser } from "@/types/auth"

type AuthProviderProps = {
  /** User lấy từ server ở root layout (null nếu không lấy được). */
  user: CurrentUser | null
  /** Session hết hạn/bị thu hồi (còn cookie nhưng /auth/me 401). */
  isExpired: boolean
  /** Lỗi khi tải phiên (mạng / 5xx). */
  isError: boolean
  children: ReactNode
}

/**
 * Input: user + isExpired + isError từ server (root layout) + children — bọc TOÀN app.
 * Output: Hydrate store cho cả app dùng. Theo trạng thái auth, render FULL-PAGE thay nội dung:
 *  - isExpired → màn hết phiên.
 *  - isError → màn lỗi.
 *  - còn lại → children.
 * Set store đồng bộ lần đầu qua initializer của useState (tránh flash), sync lại khi prop đổi.
 */
export function AuthProvider({ user, isExpired, isError, children }: AuthProviderProps) {
  useState(() => {
    useAuthStore.setState({ user, isExpired, isError })
    return null
  })
  useEffect(() => {
    useAuthStore.setState({ user, isExpired, isError })
  }, [user, isExpired, isError])

  if (isExpired) {
    return <SessionExpiredScreen />
  }
  if (isError) {
    return <SessionErrorScreen />
  }
  return children
}
