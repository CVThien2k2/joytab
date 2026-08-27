"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { completeOnboarding } from "@/api/onboarding"
import { useAuthStore } from "@/providers/auth-store-provider"

/**
 * Input: Không nhận tham số.
 * Output: Mutation gửi thông tin onboarding.
 *
 *         Thành công: cập nhật store bằng user BE trả về rồi `replace(nextPath ?? "/")` —
 *         nextPath là đích user đang muốn tới trước khi bị chặn lại (vd link mời). Không dùng
 *         push để user bấm Back không quay lại được form đã hoàn tất. `refresh()` để layout
 *         server dựng lại với user mới (cookie `onb` đã bị BE xoá nên proxy cho vào).
 *
 *         Thất bại: chỉ toast. Không reset form — user cần giữ lại thứ đã gõ để sửa.
 */
export function useCompleteOnboarding(nextPath?: string | null) {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (user) => {
      setUser(user)
      toast.success("Đã lưu thông tin. Chào mừng bạn đến Joytab!")
      router.replace(nextPath ?? "/")
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Lưu thông tin thất bại. Vui lòng thử lại."))
    },
  })
}
