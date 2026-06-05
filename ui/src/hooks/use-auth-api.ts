"use client"

import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  fetchAccounts,
  fetchAccountsStatus,
  fetchDevices,
  fetchMe,
  logoutAccount,
  revokeSession,
} from "@/lib/auth-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; phụ thuộc các account đang lưu local.
 * Output: Query check status (read-only theo cookie rt_*) và đồng bộ kết quả vào store
 *         (state.accountStatus) để TOÀN APP hiển thị đúng trạng thái, không chỉ component này.
 *         KHÔNG refresh ngầm — chỉ đánh dấu account nào cần đăng nhập lại.
 */
export function useAccountsStatus() {
  const accountIds = useAuthStore((s) => Object.keys(s.accounts).sort().join(","))
  const setAccountsStatus = useAuthStore((s) => s.setAccountsStatus)
  const query = useQuery({
    queryKey: ["auth", "accounts-status", accountIds],
    queryFn: fetchAccountsStatus,
    enabled: accountIds.length > 0,
  })

  useEffect(() => {
    if (!query.data) return
    const localIds = accountIds.split(",").filter(Boolean)
    const serverStatus = new Map(query.data.map((s) => [s.accountId, s.needsRelogin]))
    const map: Record<string, boolean> = {}
    for (const id of localIds) {
      const status = serverStatus.get(id)
      // Account còn trong local mà BE không trả về (cookie rt_ đã mất/hết hạn) => coi như cần đăng nhập lại.
      map[id] = status === undefined ? true : status
    }
    setAccountsStatus(map)
  }, [query.data, accountIds, setAccountsStatus])

  return query
}

/**
 * Input: Không nhận tham số; gọi ở PrivateLayout để chạy khi vào website.
 * Output: Trigger check status; nếu account ĐANG ACTIVE bị revoke (needsRelogin) thì không cho dùng tiếp:
 *         - còn account khác hợp lệ → switch sang đó (account chết vẫn giữ trong store để hiện badge).
 *         - không còn account hợp lệ → removeAccount(account chết) rồi để PrivateLayout tự điều hướng /login.
 *         KHÔNG tự redirect /login ở đây: account chết vẫn nằm trong store khiến AuthLayout bounce ngược về "/" → loop.
 */
export function useEnforceActiveAccountStatus() {
  useAccountsStatus()
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const accountStatus = useAuthStore((s) => s.accountStatus)
  const accountIds = useAuthStore((s) => Object.keys(s.accounts).sort().join(","))
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount)
  const removeAccount = useAuthStore((s) => s.removeAccount)

  useEffect(() => {
    if (!activeAccountId) return
    // undefined (chưa check xong) hoặc false (còn hạn) => không làm gì.
    if (!accountStatus[activeAccountId]) return
    const fallback = accountIds
      .split(",")
      .filter(Boolean)
      .find((id) => id !== activeAccountId && !accountStatus[id])
    if (fallback) {
      setActiveAccount(fallback)
    } else {
      // Bỏ account chết; nếu còn account khác (cũng chết) sẽ cascade tiếp, hết account → layout đẩy /login.
      removeAccount(activeAccountId)
    }
  }, [activeAccountId, accountStatus, accountIds, setActiveAccount, removeAccount])
}

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
