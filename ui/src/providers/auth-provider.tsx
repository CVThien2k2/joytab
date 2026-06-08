"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SessionExpiredDialog } from "@/components/auth/session-expired-dialog"
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
 * Output: Hydrate store cho cả app dùng; render popup hết phiên (client, tự quyết theo store) cho mọi route.
 *         Set đồng bộ lần đầu qua initializer của useState (tránh flash), sync lại khi prop đổi.
 */
export function AuthProvider({ user, isExpired, isError, children }: AuthProviderProps) {
  useState(() => {
    useAuthStore.setState({ user, isExpired, isError })
    return null
  })
  useEffect(() => {
    useAuthStore.setState({ user, isExpired, isError })
  }, [user, isExpired, isError])

  return (
    <>
      {children}
      <SessionExpiredDialog />
    </>
  )
}
