"use client"

import { type ReactNode } from "react"
import { useMe } from "@/hooks/use-auth-api"

/**
 * Input: children — bọc TOÀN app (trong QueryProvider).
 * Output: Kích hoạt useMe (validate /auth/me) — chính queryFn đồng bộ store, không cần useEffect ở đây.
 *         AUTH_004 → logout tự động rồi về /login; hết phiên/401 → store.user=null → RequireAuth về /login.
 */
export function AppWrapper({ children }: { children: ReactNode }) {
  // Trigger query bootstrap (kết quả được xử lý trong queryFn của useMe).
  useMe()

  return children
}
