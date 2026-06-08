import { create } from "zustand"
import type { CurrentUser } from "@/types/auth"

type AuthState = {
  /** User hiện tại lấy từ server (hydrate ở (private)/layout). FE đọc ra để hiển thị. */
  user: CurrentUser | null
  setUser: (user: CurrentUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
