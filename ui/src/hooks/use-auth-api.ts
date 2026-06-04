"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  fetchAccounts,
  fetchDevices,
  fetchMe,
  logoutAccount,
  revokeSession,
} from "@/lib/auth-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; phụ thuộc activeAccountId và session đã persist trong store.
 * Output: Query danh sách account đã link với thiết bị hiện tại.
 *         Chỉ enabled khi account active tồn tại; interceptor tự refresh nếu token đã hết hạn.
 */
export function useAccounts() {
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const hasActiveAccount = useAuthStore((s) => Boolean(s.activeAccountId && s.accounts[s.activeAccountId]))
  return useQuery({
    queryKey: ["auth", "accounts", activeAccountId],
    queryFn: () => fetchAccounts(activeAccountId as string),
    enabled: hasActiveAccount,
  })
}

/**
 * Input: Không nhận tham số; dùng access token hiện tại qua interceptor.
 * Output: Query danh sách thiết bị/phiên của user.
 *         Chỉ enabled khi account active tồn tại; key gắn activeAccountId để refetch khi switch.
 */
export function useDevices() {
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const hasActiveAccount = useAuthStore((s) => Boolean(s.activeAccountId && s.accounts[s.activeAccountId]))
  return useQuery({
    queryKey: ["auth", "devices", activeAccountId],
    queryFn: fetchDevices,
    enabled: hasActiveAccount,
  })
}

/**
 * Input: Không nhận tham số; phụ thuộc activeAccountId.
 * Output: Query thông tin user hiện tại từ BE mỗi khi đổi account.
 */
export function useMe() {
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const hasActiveAccount = useAuthStore((s) => Boolean(s.activeAccountId && s.accounts[s.activeAccountId]))
  return useQuery({
    queryKey: ["auth", "me", activeAccountId],
    queryFn: fetchMe,
    enabled: hasActiveAccount,
  })
}

/**
 * Input: sessionId khi gọi mutate.
 * Output: Revoke phiên từ xa; refetch danh sách thiết bị (prefix match invalidates all device keys).
 */
export function useRevokeSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "devices"] })
    },
  })
}

/**
 * Input: accountId khi gọi mutate.
 * Output: Gọi BE logout cho account đó, remove khỏi store, điều hướng về /login nếu không còn account nào.
 *         Cleanup chỉ chạy onSuccess — nếu BE fail (network), account vẫn giữ nguyên.
 */
export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const removeAccount = useAuthStore((s) => s.removeAccount)
  return useMutation({
    mutationFn: (accountId: string) => logoutAccount(accountId),
    onSuccess: (_d, accountId) => {
      removeAccount(accountId)
      queryClient.clear()
      if (!useAuthStore.getState().activeAccountId) router.replace("/login")
    },
  })
}
