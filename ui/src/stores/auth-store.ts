import { create } from "zustand"
import type { CurrentUser } from "@/types/auth"

type AuthState = {
  /** User hiện tại lấy từ server (null nếu không lấy được / chưa đăng nhập). */
  user: CurrentUser | null
  /** Có cookie session hay không (server truyền xuống). */
  hasSessionCookie: boolean
}

/**
 * Store auth cho toàn app — hydrate từ server ở AuthProvider (root layout).
 * `!user && hasSessionCookie` ⇒ session hỏng ⇒ hiện popup hết phiên.
 */
export const useAuthStore = create<AuthState>(() => ({
  user: null,
  hasSessionCookie: false,
}))
