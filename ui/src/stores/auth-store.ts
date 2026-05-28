import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AuthUser } from "@/lib/auth-callback"

type AuthState = {
  user: AuthUser | null
  setUser: (user: AuthUser) => void
  clearUser: () => void
}

export const AUTH_STORAGE_KEY = "joytab-auth-store"

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      /**
       * Input: User profile vừa nhận sau khi BE exchange code thành công.
       * Output: Lưu thông tin hiển thị vào store (không lưu access token).
       */
      setUser: (user) => set({ user }),

      /**
       * Input: Không nhận tham số.
       * Output: Xoá user info trong store khi logout hoặc session kết thúc.
       */
      clearUser: () => set({ user: null }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
