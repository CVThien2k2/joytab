"use client"

import { useEffect, useState, type ReactNode } from "react"
import { SessionExpiredDialog } from "@/components/auth/session-expired-dialog"
import { useAuthStore } from "@/stores/auth-store"
import type { CurrentUser } from "@/types/auth"

type AuthProviderProps = {
  /** User lấy từ server ở root layout (null nếu không lấy được). */
  user: CurrentUser | null
  /** Có cookie session hay không (server truyền xuống). */
  hasSessionCookie: boolean
  children: ReactNode
}

/**
 * Input: user + hasSessionCookie từ server (root layout) + children — bọc TOÀN app.
 * Output: Hydrate store cho cả app dùng; render popup hết phiên (client, tự quyết theo store) cho mọi route.
 *         Set đồng bộ lần đầu qua initializer của useState (tránh flash), sync lại khi prop đổi.
 */
export function AuthProvider({ user, hasSessionCookie, children }: AuthProviderProps) {
  useState(() => {
    useAuthStore.setState({ user, hasSessionCookie })
    return null
  })
  useEffect(() => {
    useAuthStore.setState({ user, hasSessionCookie })
  }, [user, hasSessionCookie])

  return (
    <>
      {children}
      <SessionExpiredDialog />
    </>
  )
}
