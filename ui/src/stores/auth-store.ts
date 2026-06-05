import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AuthSession } from "@/lib/auth-callback"

type AuthState = {
  accounts: Record<string, AuthSession>
  activeAccountId: string | null
  /** accountId -> cần đăng nhập lại (runtime, không persist). Suy từ check status theo cookie rt_*. */
  accountStatus: Record<string, boolean>
  addAccount: (session: AuthSession) => void
  setActiveAccount: (accountId: string) => void
  updateAccessToken: (accountId: string, accessToken: string, accessTokenExpiresAt: string) => void
  removeAccount: (accountId: string) => void
  setAccountsStatus: (status: Record<string, boolean>) => void
}

export const AUTH_STORAGE_KEY = "joytab-auth-store"

/**
 * Input: Thời điểm hết hạn access token dạng ISO string.
 * Output: true nếu token đã hết hạn hoặc sắp hết hạn trong 30 giây.
 */
export function isAccessTokenExpired(accessTokenExpiresAt: string): boolean {
  const expiresAt = Date.parse(accessTokenExpiresAt)
  if (!Number.isFinite(expiresAt)) {
    return true
  }
  return expiresAt <= Date.now() + 30_000
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accounts: {},
      activeAccountId: null,
      accountStatus: {},

      addAccount: (session) =>
        set((state) => {
          return {
            accounts: {
              ...state.accounts,
              [session.userId]: session,
            },
            activeAccountId: session.userId,
            // Vừa đăng nhập xong nên chắc chắn còn hạn.
            accountStatus: { ...state.accountStatus, [session.userId]: false },
          }
        }),

      setActiveAccount: (accountId) =>
        set((state) => ({
          activeAccountId: state.accounts[accountId] ? accountId : state.activeAccountId,
        })),

      updateAccessToken: (accountId, accessToken, accessTokenExpiresAt) =>
        set((state) => ({
          accounts: state.accounts[accountId]
            ? {
                ...state.accounts,
                [accountId]: {
                  ...state.accounts[accountId],
                  accessToken,
                  accessTokenExpiresAt,
                },
              }
            : state.accounts,
        })),

      removeAccount: (accountId) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [accountId]: _removed, ...accounts } = state.accounts
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [accountId]: _removedStatus, ...accountStatus } = state.accountStatus
          const accountIds = Object.keys(accounts)
          const activeAccountId =
            state.activeAccountId === accountId ? (accountIds[0] ?? null) : state.activeAccountId
          return { accounts, activeAccountId, accountStatus }
        }),

      setAccountsStatus: (status) => set({ accountStatus: status }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // accountStatus là trạng thái runtime — không persist để tránh hiện badge cũ trước khi check lại.
      partialize: (state) => ({ accounts: state.accounts, activeAccountId: state.activeAccountId }),
    },
  ),
)
