"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  fetchAccounts,
  fetchDevices,
  fetchMe,
  logout,
  revokeSession,
  switchAccount,
} from "@/api/auth"

const AUTH_ME_KEY = ["auth", "me"]
const AUTH_ACCOUNTS_KEY = ["auth", "accounts"]
const AUTH_DEVICES_KEY = ["auth", "devices"]

/**
 * Input: Không nhận tham số; dựa vào cookie session_id.
 * Output: Query thông tin user hiện tại. 401 → query.isError, dùng để gate route private.
 */
export function useMe() {
  return useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchMe,
    retry: false,
  })
}

/**
 * Input: Không nhận tham số; dựa vào cookie device_id.
 * Output: Query danh sách account trên thiết bị (cho account switcher). Không cần session active.
 */
export function useAccounts() {
  return useQuery({
    queryKey: AUTH_ACCOUNTS_KEY,
    queryFn: fetchAccounts,
    retry: false,
  })
}

/**
 * Input: Không nhận tham số; dùng cookie session_id.
 * Output: Query danh sách thiết bị/phiên của user hiện tại.
 */
export function useDevices() {
  return useQuery({
    queryKey: AUTH_DEVICES_KEY,
    queryFn: fetchDevices,
    retry: false,
  })
}

/**
 * Input: sessionId khi gọi mutate.
 * Output: Revoke phiên từ xa rồi refetch danh sách thiết bị.
 */
export function useRevokeSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_DEVICES_KEY })
    },
  })
}

/**
 * Input: userId khi gọi mutate.
 * Output: Đổi account active rồi refetch me + accounts + devices để UI cập nhật.
 */
export function useSwitchAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => switchAccount(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_KEY })
      void queryClient.invalidateQueries({ queryKey: AUTH_ACCOUNTS_KEY })
      void queryClient.invalidateQueries({ queryKey: AUTH_DEVICES_KEY })
    },
  })
}

/**
 * Input: Không nhận tham số.
 * Output: Đăng xuất account hiện tại. Nếu thiết bị còn account khác đang sống → chuyển sang đó;
 *         không còn → clear cache và về /login.
 */
export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await logout()
      const accounts = await fetchAccounts()
      return accounts.find((account) => !account.needsRelogin) ?? null
    },
    onSuccess: async (fallback) => {
      if (fallback) {
        await switchAccount(fallback.userId)
        // Home là Server Component → refresh để render lại theo session mới (invalidate cho client query nếu có).
        await queryClient.invalidateQueries()
        router.refresh()
        return
      }
      queryClient.clear()
      toast.success("Đã đăng xuất")
      router.replace("/login")
    },
  })
}
