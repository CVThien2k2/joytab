import { createStore } from "zustand/vanilla"
import type { CurrentUser } from "@/types/auth"

export type AuthState = { user: CurrentUser | null }

export type AuthActions = {
  setUser: (user: CurrentUser | null) => void
  clearUser: () => void
}

export type AuthStore = AuthState & AuthActions

export const defaultAuthState: AuthState = { user: null }

/**
 * Input: State khởi tạo (do Next server truyền xuống).
 * Output: Một store MỚI. Đây là factory chứ không phải store toàn cục: store toàn cục là
 *         biến module-scope, trên server nó bị chia sẻ giữa các request đồng thời nên user
 *         này có thể đọc thấy dữ liệu của user khác.
 *         Theo hướng dẫn Next.js của zustand (docs/learn/guides/nextjs.md).
 */
export const createAuthStore = (initState: AuthState = defaultAuthState) =>
  createStore<AuthStore>()((set) => ({
    ...initState,
    setUser: (user) => set({ user }),
    clearUser: () => set({ user: null }),
  }))
