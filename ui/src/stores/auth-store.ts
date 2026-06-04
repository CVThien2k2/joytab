import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AuthSession } from "@/lib/auth-callback"

type AuthState = {
  accounts: Record<string, AuthSession>
  activeAccountId: string | null
  addAccount: (session: AuthSession) => void
  setActiveAccount: (accountId: string) => void
  updateAccessToken: (accountId: string, accessToken: string, accessTokenExpiresAt: string) => void
  removeAccount: (accountId: string) => void
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

      addAccount: (session) =>
        set((state) => {
          return {
            accounts: {
              ...state.accounts,
              [session.userId]: session,
            },
            activeAccountId: session.userId,
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
          const accountIds = Object.keys(accounts)
          const activeAccountId =
            state.activeAccountId === accountId ? (accountIds[0] ?? null) : state.activeAccountId
          return { accounts, activeAccountId }
        }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
