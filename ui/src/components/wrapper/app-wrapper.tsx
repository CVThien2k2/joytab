"use client"

import { type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useMe } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/stores/auth-store"
import { SessionRevokedDialog } from "@/components/common/session-revoked-dialog"

// Trang public không hiện popup revoked (đã ở luồng đăng nhập).
const NO_POPUP_PATHS = ["/login"]

/**
 * Input: children — bọc TOÀN app (trong QueryProvider).
 * Output: Kích hoạt useMe (validate /auth/me) — chính queryFn đồng bộ store, không cần useEffect ở đây.
 *         AUTH_004 → store.revoked → popup; hết phiên/401 → store.user=null → RequireAuth về /login.
 */
export function AppWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const revoked = useAuthStore((state) => state.revoked)

  // Trigger query bootstrap (kết quả được xử lý trong queryFn của useMe).
  useMe()

  return (
    <>
      {children}
      <SessionRevokedDialog open={revoked && !NO_POPUP_PATHS.includes(pathname)} />
    </>
  )
}
