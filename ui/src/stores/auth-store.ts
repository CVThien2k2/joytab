import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CurrentUser } from "@/types/auth"

type AuthState = {
  user: CurrentUser | null
  hydrated: boolean
  setUser: (user: CurrentUser) => void
  clearUser: () => void
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: "joytab-auth",
      partialize: (state) => ({ user: state.user }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true })
      },
    },
  ),
)
