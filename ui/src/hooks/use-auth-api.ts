"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import axios from "axios"
import {
  fetchDevices,
  fetchMe,
  logout,
  revokeSession,
} from "@/api/auth"
import { useAuthStore } from "@/stores/auth-store"

const AUTH_ME_KEY = ["auth", "me"]
const AUTH_DEVICES_KEY = ["auth", "devices"]

/** Lấy mã lỗi BE ({ code }) từ AxiosError của /auth/me. */
function extractErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { code?: string } | undefined)?.code
  }
  return undefined
}

/**
 * Input: Không nhận tham số; dựa vào cookie session_id.
 * Output: Query /auth/me VÀ đồng bộ store ngay trong queryFn (khỏi useEffect ở AppWrapper):
 *  - 200 → set user, checked.
 *  - AUTH_004 phiên bị thu hồi → logout dọn cookie rồi về /login.
 *  - AUTH_005 hết phiên / AUTH_001 → xoá user + checked (⇒ RequireAuth về /login).
 */
export function useMe() {
  return useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: async () => {
      try {
        const user = await fetchMe()
        useAuthStore.setState({ user, checked: true })
        return user
      } catch (error) {
        if (extractErrorCode(error) === "AUTH_004") {
          useAuthStore.setState({ user: null, checked: true })
          await logout().catch(() => undefined)
          if (typeof window !== "undefined") {
            window.location.href = "/login"
          }
        } else {
          useAuthStore.setState({ user: null, checked: true })
        }
        throw error
      }
    },
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
 * Input: Không nhận tham số.
 * Output: Đăng xuất phiên hiện tại, clear cache và về /login.
 */
export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear()
      toast.success("Đã đăng xuất")
      router.replace("/login")
    },
  })
}
