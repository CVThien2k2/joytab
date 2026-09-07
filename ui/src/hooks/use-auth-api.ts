"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { fetchMe, updateProfile } from "@/api/auth"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Khoá cache của phiên. Khai một chỗ để mutation invalidate đúng thứ query đang giữ — hai chỗ
 * tự viết tay mảng khoá là hai chỗ có thể lệch nhau.
 */
export const authQueryKeys = {
  me: ["auth", "me"] as const,
}

/**
 * Input: Không nhận tham số.
 * Output: Query /auth/me, ĐỒNG THỜI bơm user vào store — nguồn bootstrap của cả khu đã đăng
 *         nhập (xem SessionGate) và của /onboarding.
 *
 *         Việc bơm store nằm ngay trong hook này để chỉ có MỘT chỗ làm: hai màn hình cùng cần
 *         (SessionGate và OnboardingView), mỗi nơi tự viết một effect là hai nơi có thể quên.
 *         Nơi gọi chỉ cần chờ `useAuthStore().user` khác null là biết store đã sẵn sàng.
 *
 *         `retry: false`: 401 đã do apiClient lo (xoay token rồi chạy lại request, xoay hỏng
 *         thì đưa về /logout), nên lỗi tới được đây là lỗi thật — thử lại chỉ kéo dài màn chờ.
 *
 *         `staleTime` dài: user chỉ đổi khi chính họ sửa thông tin, mà chỗ đó tự cập nhật.
 */
export function useMe() {
  const query = useQuery({
    queryKey: authQueryKeys.me,
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000,
  })
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    if (query.data) setUser(query.data)
  }, [query.data, setUser])

  return query
}

/**
 * Input: Không nhận tham số.
 * Output: `{ isPending, mutate }` — bấm là sang trang /logout.
 *
 *         Việc đăng xuất thật (gọi BE, xoá cookie, về /login) nằm ở app/logout/page.tsx: nó
 *         phải chạy được cả khi phiên đã chết, nên không thể là một mutation trong khu đã
 *         đăng nhập. Hook này chỉ còn là cái nút.
 *
 *         Đi bằng `window.location` chứ không router: nạp lại cả app thì không còn store hay
 *         cache nào của phiên cũ nằm lại trong bộ nhớ.
 */
export function useLogout() {
  const [isPending, setPending] = useState(false)

  return {
    isPending,
    mutate: () => {
      setPending(true)
      window.location.assign("/logout")
    },
  }
}

/**
 * Input: Callback chạy sau khi lưu thành công (tuỳ chọn — vd đóng dialog).
 * Output: Mutation sửa thông tin cá nhân.
 *
 *         Cập nhật store NGAY từ response thay vì chờ query chạy lại: avatar và tên hiện ở
 *         sidebar lẫn bảng thành viên, đợi round-trip mới thấy đổi thì cảm giác như bấm lưu
 *         không có tác dụng.
 *
 *         Vẫn invalidate /auth/me: store là ảnh chụp lúc bootstrap, còn cache mới là thứ dựng
 *         lại store ở lần mount sau (F5, mở tab khác). Không làm mới thì lần sau vẫn là dữ liệu cũ.
 */
export function useUpdateProfile(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      setUser(user)
      toast.success("Đã lưu thông tin")
      onSuccess?.()
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.me })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không lưu được thông tin. Vui lòng thử lại."))
    },
  })
}
