"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { createOrganization, joinOrganizationByCode } from "@/api/organizations"
import type { Organization } from "@/types/organization"

/** Router của Next — chỉ cần đúng hàm refresh nên khai hẹp lại cho dễ đọc. */
type RefreshableRouter = { refresh: () => void }

/**
 * Input: Callback đóng dialog sau khi thành công (tuỳ chọn).
 * Output: Mutation tạo tổ chức.
 */
export function useCreateOrganization(onSuccess?: () => void) {
  const router = useRouter()
  return useMutation({
    mutationFn: createOrganization,
    ...buildHandlers({
      router,
      successMessage: (organization) => `Đã tạo tổ chức "${organization.name}"`,
      fallbackError: "Tạo tổ chức thất bại. Vui lòng thử lại.",
      onSuccess,
    }),
  })
}

/**
 * Input: Callback đóng dialog sau khi thành công (tuỳ chọn).
 * Output: Mutation tham gia tổ chức bằng mã.
 */
export function useJoinOrganization(onSuccess?: () => void) {
  const router = useRouter()
  return useMutation({
    mutationFn: joinOrganizationByCode,
    ...buildHandlers({
      router,
      successMessage: (organization) => `Đã tham gia "${organization.name}"`,
      fallbackError: "Tham gia tổ chức thất bại. Vui lòng thử lại.",
      onSuccess,
    }),
  })
}

/**
 * Input: router, hàm dựng message thành công, message lỗi mặc định, callback đóng dialog.
 * Output: Cặp onSuccess/onError dùng chung cho cả hai mutation — chúng khác nhau đúng ở
 *         message, gộp lại để không phải sửa hai chỗ khi đổi cách làm mới dữ liệu.
 *
 *         KHÔNG phải hook (không gọi useRouter bên trong): router truyền từ ngoài vào để
 *         hàm này gọi được ở bất kỳ đâu mà không phá quy tắc hook.
 *
 *         Làm mới bằng `router.refresh()` chứ không invalidateQueries: danh sách tổ chức do
 *         server component fetch, không nằm trong cache react-query.
 */
function buildHandlers(params: {
  router: RefreshableRouter
  successMessage: (organization: Organization) => string
  fallbackError: string
  onSuccess?: () => void
}) {
  return {
    onSuccess: (organization: Organization) => {
      toast.success(params.successMessage(organization))
      params.onSuccess?.()
      params.router.refresh()
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, params.fallbackError))
    },
  }
}
