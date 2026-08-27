"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import {
  createOrganization,
  deleteOrganization,
  fetchOrganizationMembers,
  joinOrganizationByCode,
  removeOrganizationMember,
  updateJoinByCodeEnabled,
  updateOrganization,
  type MemberListParams,
} from "@/api/organizations"
import type { Organization } from "@/types/organization"

/** Router của Next — chỉ cần đúng hàm refresh nên khai hẹp lại cho dễ đọc. */
type RefreshableRouter = { refresh: () => void }

/**
 * Khoá cache của danh sách thành viên. Khai một chỗ để mutation invalidate đúng thứ mà query
 * đang giữ — hai chỗ tự viết tay mảng khoá là hai chỗ có thể lệch nhau.
 *
 * Không có `q`/`page` ở khoá gốc: `invalidateQueries` khớp theo tiền tố nên xoá một người sẽ
 * làm mới MỌI trang và MỌI từ khoá của tổ chức đó, không chỉ trang đang xem.
 */
export const memberQueryKeys = {
  all: (organizationId: string) => ["organizations", organizationId, "members"] as const,
  page: (params: MemberListParams) =>
    [
      ...memberQueryKeys.all(params.organizationId),
      params.page,
      params.pageSize,
      params.q ?? "",
    ] as const,
}

/**
 * Input: id tổ chức + trang + từ khoá.
 * Output: Query một trang thành viên.
 *
 *         Đây là dữ liệu DUY NHẤT của khu vực tổ chức fetch từ client — user (/auth/me) và
 *         danh sách tổ chức (/organizations) vẫn do server component lấy để lần render đầu đã
 *         có sẵn. Riêng danh sách thành viên nằm sau một tab và còn phân trang/tìm kiếm, nên để
 *         React Query giữ cache: quay lại trang cũ trong 30 giây là hiện ngay.
 *
 *         `keepPreviousData`: đổi trang thì giữ dữ liệu trang cũ trên màn hình cho tới khi
 *         trang mới về — không có nó thì bảng rỗng một nhịp và cả khung co lại rồi giãn ra.
 *
 *         `staleTime` 30 giây chứ không 0: danh sách thành viên đổi khi có người vào/ra, tính
 *         theo phút chứ không theo giây, nên refetch mỗi lần bấm tab là tốn công vô ích.
 */
export function useOrganizationMembers(params: MemberListParams) {
  return useQuery({
    queryKey: memberQueryKeys.page(params),
    queryFn: () => fetchOrganizationMembers(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/**
 * Input: Callback đóng dialog sau khi thành công (tuỳ chọn).
 * Output: Mutation đổi tên tổ chức.
 *
 *         Chỉ gửi `name`, KHÔNG gửi kèm `joinByCodeEnabled`: BE coi mỗi field là một ý định
 *         riêng, gửi kèm công tắc là vô tình xoay mã tham gia và làm chết mọi liên kết mời.
 *
 *         Làm mới bằng `router.refresh()`: danh sách tổ chức do server component fetch rồi bơm
 *         vào store, không nằm trong cache react-query.
 */
export function useUpdateOrganization(onSuccess?: () => void) {
  const router = useRouter()

  return useMutation({
    mutationFn: updateOrganization,
    onSuccess: (organization) => {
      toast.success(`Đã đổi tên tổ chức thành "${organization.name}"`)
      onSuccess?.()
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không lưu được thông tin tổ chức. Vui lòng thử lại."))
    },
  })
}

/**
 * Input: id tổ chức + callback đóng dialog (tuỳ chọn).
 * Output: Mutation xoá một người khỏi tổ chức — owner đuổi thành viên.
 *
 *         Làm mới HAI nơi vì cùng một hành động đổi hai loại dữ liệu: `invalidateQueries` cho
 *         danh sách thành viên (React Query giữ), và `router.refresh()` cho `memberCount` trong
 *         danh sách tổ chức (server component giữ, hiện ở sidebar và trang Thông tin tổ chức).
 */
export function useRemoveOrganizationMember(organizationId: string, onSuccess?: () => void) {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeOrganizationMember({ organizationId, userId }),
    onSuccess: () => {
      toast.success("Đã xoá thành viên khỏi tổ chức")
      onSuccess?.()
      void queryClient.invalidateQueries({ queryKey: memberQueryKeys.all(organizationId) })
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không xoá được thành viên. Vui lòng thử lại."))
    },
  })
}

/**
 * Input: Tổ chức đang xem (cần cả tên để viết toast).
 * Output: Mutation rời tổ chức — người gọi tự xoá mình. Owner gọi sẽ ăn ORG_005 từ BE.
 *
 *         Xong thì `replace("/")` chứ không `push`: tổ chức vừa rời không còn là chỗ để bấm
 *         Back quay lại — vào lại chỉ ăn notFound. `/` tự chọn tổ chức khác, hoặc hiện màn hình
 *         "chưa thuộc tổ chức nào".
 */
export function useLeaveOrganization(organization: { id: string; name: string }, userId: string) {
  const router = useRouter()

  return useMutation({
    mutationFn: () => removeOrganizationMember({ organizationId: organization.id, userId }),
    onSuccess: () => {
      toast.success(`Đã rời "${organization.name}"`)
      router.replace("/")
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không rời được tổ chức. Vui lòng thử lại."))
    },
  })
}

/**
 * Input: Tổ chức đang xem.
 * Output: Mutation xoá cả tổ chức (chỉ owner). Cũng `replace("/")` vì lý do như rời tổ chức.
 */
export function useDeleteOrganization(organization: { id: string; name: string }) {
  const router = useRouter()

  return useMutation({
    mutationFn: () => deleteOrganization(organization.id),
    onSuccess: () => {
      toast.success(`Đã xoá tổ chức "${organization.name}"`)
      router.replace("/")
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không xoá được tổ chức. Vui lòng thử lại."))
    },
  })
}

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
 * Input: Không nhận tham số.
 * Output: Mutation bật/tắt cửa vào bằng mã của một tổ chức (chỉ owner gọi được).
 *
 *         Không dùng buildHandlers: hai mutation kia báo "đã vào tổ chức X", còn cái này phải
 *         nói rõ vừa mở hay vừa đóng — thông tin đó nằm ở payload gửi đi chứ không ở kết quả.
 */
export function useToggleJoinByCode() {
  const router = useRouter()
  return useMutation({
    mutationFn: updateJoinByCodeEnabled,
    onSuccess: (organization) => {
      toast.success(
        organization.joinByCodeEnabled
          ? `Đã mở cửa "${organization.name}" — mã mới: ${organization.joinCode}`
          : `Đã đóng cửa "${organization.name}" — mã cũ hết hiệu lực`,
      )
      router.refresh()
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không đổi được trạng thái. Vui lòng thử lại."))
    },
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
