import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AuthSession } from "@/lib/auth-callback"

type AuthState = {
  isAuthenticated: boolean
  session: AuthSession | null
  loginWithSession: (session: AuthSession) => void
  logout: () => void
}

export const AUTH_STORAGE_KEY = "joytab-auth-store"

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      session: null,

      /**
       * Input: Session token + user trả về sau khi BE exchange code thành công.
       * Output: Đánh dấu người dùng đã đăng nhập và lưu session vào store.
       */
      loginWithSession: (session) =>
        set({
          isAuthenticated: true,
          session,
        }),

      /**
       * Input: Không nhận tham số.
       * Output: Xóa trạng thái đăng nhập cục bộ khỏi store.
       */
      logout: () =>
        set({
          isAuthenticated: false,
          session: null,
        }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
      }),
    },
  ),
)
