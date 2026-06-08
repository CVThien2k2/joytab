import { create } from "zustand"
import type { CurrentUser } from "@/types/auth"

type AuthState = {
  /** User hiện tại lấy từ server (null nếu không lấy được / chưa đăng nhập). */
  user: CurrentUser | null
  /** Session hết hạn/bị thu hồi (còn cookie nhưng /auth/me 401) ⇒ hiện popup hết phiên. */
  isExpired: boolean
  /** Lỗi khi tải phiên (mạng / 5xx) ⇒ báo lỗi. */
  isError: boolean
}

/**
 * Store auth cho toàn app — hydrate từ server ở AuthProvider (root layout).
 */
export const useAuthStore = create<AuthState>(() => ({
  user: null,
  isExpired: false,
  isError: false,
}))
