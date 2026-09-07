"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { completeOnboarding } from "@/api/onboarding"
import { authQueryKeys } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số.
 * Output: Mutation gửi thông tin onboarding.
 *
 *         Thành công: cập nhật store bằng user BE trả về rồi `replace(nextPath ?? "/")` —
 *         nextPath là đích user đang muốn tới trước khi bị chặn lại (vd link mời). Không dùng
 *         push để user bấm Back không quay lại được form đã hoàn tất. Bơm luôn user vừa nhận
 *         vào cache /auth/me (setQueryData, không invalidate): SessionGate của khu đã đăng nhập
 *         dựng store từ cache đó, có sẵn thì nó không phải chờ thêm một lượt gọi nữa mới vào
 *         được app — mà cũng không dùng lại bản còn thiếu thông tin.
 *
 *         Thất bại: chỉ toast. Không reset form — user cần giữ lại thứ đã gõ để sửa.
 */
export function useCompleteOnboarding(nextPath?: string | null) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (user) => {
      setUser(user)
      toast.success("Đã lưu thông tin. Chào mừng bạn đến Joytab!")
      queryClient.setQueryData(authQueryKeys.me, user)
      router.replace(nextPath ?? "/")
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Lưu thông tin thất bại. Vui lòng thử lại."))
    },
  })
}
