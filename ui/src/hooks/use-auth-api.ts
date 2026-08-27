"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { logout, updateProfile } from "@/api/auth"
import { useAuthStore } from "@/providers/auth-store-provider"

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

/**
 * Input: Callback chạy sau khi lưu thành công (tuỳ chọn — vd đóng dialog).
 * Output: Mutation sửa thông tin cá nhân.
 *
 *         Cập nhật store NGAY từ response thay vì chờ `router.refresh()`: avatar và tên hiện ở
 *         sidebar lẫn bảng thành viên, đợi round-trip mới thấy đổi thì cảm giác như bấm lưu
 *         không có tác dụng.
 *
 *         Vẫn gọi thêm `router.refresh()`: /auth/me do server component fetch, không làm mới thì
 *         lần điều hướng sau (hoặc F5) lại render bằng dữ liệu cũ của server.
 */
export function useUpdateProfile(onSuccess?: () => void) {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      setUser(user)
      toast.success("Đã lưu thông tin")
      onSuccess?.()
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không lưu được thông tin. Vui lòng thử lại."))
    },
  })
}
