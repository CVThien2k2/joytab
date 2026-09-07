"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import {
  createOrganization,
  deleteOrganization,
  fetchOrganizationMembers,
  fetchOrganizationPreview,
  fetchOrganizations,
  joinOrganizationByCode,
  removeOrganizationMember,
  setActiveOrganization,
  updateJoinByCodeEnabled,
  updateOrganization,
  updatePaymentQr,
  type MemberListParams,
} from "@/api/organizations"
import type { Organization } from "@/types/organization"

/**
 * Khoá cache của tổ chức. Danh sách này là dữ liệu bootstrap của cả khu đã đăng nhập (sidebar,
 * nút chuyển tổ chức, tổ chức đang xem) nên mọi mutation đổi nó đều invalidate đúng khoá này.
 */
export const organizationQueryKeys = {
  list: ["organizations", "list"] as const,
  preview: (joinCode: string) => ["organizations", "preview", joinCode] as const,
}

/**
 * Input: Không nhận tham số.
 * Output: Query GET /organizations — danh sách tổ chức + tổ chức xem lần gần nhất.
 *
 *         `retry: false` và `staleTime` dài, cùng lý do như useMe: 401 đã do apiClient lo, còn
 *         danh sách tổ chức chỉ đổi khi user tạo/tham gia/rời — những chỗ đó tự invalidate.
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationQueryKeys.list,
    queryFn: fetchOrganizations,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/**
 * Input: Mã tham gia trên URL của link mời.
 * Output: Query xem trước lời mời.
 *
 *         `retry: false`: mã sai (ORG_002) là câu trả lời dứt khoát của BE, gọi lại vẫn thế —
 *         mà route này còn bị throttle 10 lượt/phút.
 */
export function useOrganizationPreview(joinCode: string) {
  return useQuery({
    queryKey: organizationQueryKeys.preview(joinCode),
    queryFn: () => fetchOrganizationPreview(joinCode),
    retry: false,
  })
}

/**
 * Input: Không nhận tham số.
 * Output: Mutation ghi cookie `org` (nhớ tổ chức vừa chuyển sang).
 *
 *         Im lặng: không toast, không invalidate. Đây chỉ là ghi nhớ cho lần vào app sau —
 *         người dùng đã thấy kết quả bằng việc trang đổi sang tổ chức mới. Lỗi cũng bỏ qua:
 *         tệ nhất là lần sau vào rơi về tổ chức cũ, không đáng chặn việc chuyển trang.
 */
export function useSetActiveOrganization() {
  return useMutation({ mutationFn: setActiveOrganization })
}

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
 *         Khác `useOrganizations` ở nhịp làm mới: danh sách thành viên nằm sau một tab và còn
 *         phân trang/tìm kiếm, nên `staleTime` ngắn hơn — quay lại trang cũ trong 30 giây là
 *         hiện ngay, còn sau đó thì gọi lại.
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
 *         Làm mới bằng invalidate danh sách tổ chức: tên hiện ở sidebar và ở nút chuyển tổ
 *         chức, cả hai đọc từ store được dựng từ chính query đó.
 */
export function useUpdateOrganization(onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateOrganization,
    onSuccess: (organization) => {
      toast.success(`Đã lưu thông tin "${organization.name}"`)
      onSuccess?.()
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
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
 *         Làm mới HAI khoá vì cùng một hành động đổi hai loại dữ liệu: danh sách thành viên,
 *         và `memberCount` trong danh sách tổ chức (hiện ở sidebar và trang Thông tin tổ chức).
 */
export function useRemoveOrganizationMember(organizationId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeOrganizationMember({ organizationId, userId }),
    onSuccess: () => {
      toast.success("Đã xoá thành viên khỏi tổ chức")
      onSuccess?.()
      void queryClient.invalidateQueries({ queryKey: memberQueryKeys.all(organizationId) })
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => removeOrganizationMember({ organizationId: organization.id, userId }),
    onSuccess: () => {
      toast.success(`Đã rời "${organization.name}"`)
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
      router.replace("/")
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteOrganization(organization.id),
    onSuccess: () => {
      toast.success(`Đã xoá tổ chức "${organization.name}"`)
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
      router.replace("/")
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createOrganization,
    ...buildHandlers({
      queryClient,
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: joinOrganizationByCode,
    ...buildHandlers({
      queryClient,
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateJoinByCodeEnabled,
    onSuccess: (organization) => {
      toast.success(
        organization.joinByCodeEnabled
          ? `Đã mở cửa "${organization.name}" — mã mới: ${organization.joinCode}`
          : `Đã đóng cửa "${organization.name}" — mã cũ hết hiệu lực`,
      )
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không đổi được trạng thái. Vui lòng thử lại."))
    },
  })
}

/**
 * Input: queryClient, hàm dựng message thành công, message lỗi mặc định, callback đóng dialog.
 * Output: Cặp onSuccess/onError dùng chung cho cả hai mutation — chúng khác nhau đúng ở
 *         message, gộp lại để không phải sửa hai chỗ khi đổi cách làm mới dữ liệu.
 *
 *         KHÔNG phải hook (không gọi useQueryClient bên trong): client truyền từ ngoài vào để
 *         hàm này gọi được ở bất kỳ đâu mà không phá quy tắc hook.
 */
function buildHandlers(params: {
  queryClient: QueryClient
  successMessage: (organization: Organization) => string
  fallbackError: string
  onSuccess?: () => void
}) {
  return {
    onSuccess: (organization: Organization) => {
      toast.success(params.successMessage(organization))
      params.onSuccess?.()
      void params.queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, params.fallbackError))
    },
  }
}

/**
 * Input: Không nhận tham số.
 * Output: Mutation đổi/gỡ mã QR thanh toán của tổ chức.
 *
 *         Tách khỏi useUpdateOrganization (form sửa thông tin) vì ảnh lưu NGAY khi chọn, không
 *         chờ bấm Lưu — giữ một URL chưa lưu trong form chỉ tạo ảnh mồ côi trên S3 khi người ta
 *         rời trang.
 *
 *         Invalidate danh sách tổ chức: ảnh QR nằm trong chính tổ chức đó, mà store của khu
 *         này được dựng từ query danh sách.
 */
export function useUpdatePaymentQr() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePaymentQr,
    onSuccess: (_organization, variables) => {
      toast.success(variables.paymentQrUrl ? "Đã cập nhật mã QR" : "Đã gỡ mã QR")
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không lưu được mã QR. Vui lòng thử lại."))
    },
  })
}
