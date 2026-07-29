"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logout } from "@/api/auth"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số.
 * Output: Đăng xuất — BE revoke refresh token + xoá cookie, FE xoá store (kèm localStorage),
 *         clear cache rồi về /login.
 *
 *         Lưu ý: access token là JWT stateless nên nếu ai đó đang giữ bản copy của cookie
 *         `at` thì nó vẫn dùng được tới khi hết hạn (tối đa 1 giờ). Logout chỉ chặn được
 *         refresh, không kill được AT đang lưu hành.
 */
export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearUser = useAuthStore((state) => state.clearUser)
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearUser()
      queryClient.clear()
      toast.success("Đã đăng xuất")
      router.replace("/login")
    },
  })
}
