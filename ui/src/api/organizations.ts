import axios from "axios"
import { apiClient } from "@/api/client"
import {
  activeOrganizationResponseSchema,
  organizationListResponseSchema,
  organizationMemberListResponseSchema,
  organizationOverviewResponseSchema,
  organizationPreviewResponseSchema,
  organizationResponseSchema,
} from "@/schema/organization"
import type {
  CreateOrganizationPayload,
  EditOrganizationPayload,
  JoinOrganizationPayload,
  Organization,
  OrganizationMember,
  OrganizationOverview,
  OrganizationPreview,
  Pagination,
} from "@/types/organization"

/** Danh sách tổ chức + tổ chức xem lần gần nhất, đi cùng nhau vì cùng một lượt gọi. */
export type OrganizationList = {
  organizations: Organization[]
  activeOrganizationId: string | null
}

/**
 * Input: Không nhận tham số; dùng cookie `at` + `org` hiện tại.
 * Output: Tổ chức của user (cũ nhất trước) kèm id tổ chức xem lần gần nhất.
 *
 *         Mảng rỗng là kết quả HỢP LỆ (user mới, chưa vào tổ chức nào) — không phải lỗi.
 *
 *         `activeOrganizationId` do BE đọc từ cookie `org` rồi đối chiếu với chính danh sách
 *         này: cookie httpOnly nên client không đọc được, mà cũng không nên tin nếu đọc được
 *         (user có thể đã rời tổ chức đó từ máy khác).
 */
export async function fetchOrganizations(): Promise<OrganizationList> {
  const response = await apiClient.get("/organizations")
  return organizationListResponseSchema.parse(response.data).data
}

/**
 * Input: id tổ chức user vừa chuyển sang.
 * Output: Ghi cookie `org` ở BE để lần vào app sau về đúng tổ chức này.
 *
 *         Không điều hướng và không đổi store — đó là việc của nơi gọi. Tách ra vì URL
 *         `/orgs/[orgId]` mới là nguồn sự thật của "đang xem tổ chức nào"; cookie chỉ là bộ nhớ.
 */
export async function setActiveOrganization(organizationId: string): Promise<string> {
  const response = await apiClient.post("/organizations/active", { organizationId })
  return activeOrganizationResponseSchema.parse(response.data).data.activeOrganizationId
}

/** Mã lỗi nghiệp vụ của BE cho "mã sai hoặc tổ chức đang đóng cửa" (api ERROR_CODES.ORG_002). */
export const JOIN_CODE_UNUSABLE_CODE = "ORG_002"

/**
 * Input: Lỗi bất kỳ từ lượt xem trước lời mời.
 * Output: true nếu đây là "link mời không dùng được" chứ không phải sự cố.
 *
 *         400 tính là không dùng được: mã sai định dạng ngay từ URL thì với người dùng cũng
 *         chỉ là một cái link hỏng, không cần thấy màn hình lỗi đỏ.
 */
export function isJoinCodeUnusable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const code = (error.response?.data as { code?: string } | undefined)?.code
  return code === JOIN_CODE_UNUSABLE_CODE || error.response?.status === 400
}

/**
 * Input: Mã tham gia lấy từ URL của link mời (/join/ABCD1234).
 * Output: Tên + số thành viên + đã là thành viên chưa, để dựng màn hình xác nhận.
 *
 *         Mã sai / tổ chức đóng cửa thì BE trả ORG_002 — nơi gọi phân biệt bằng mã lỗi đó
 *         (xem hooks/use-organizations-api.ts), vì đây là kết quả BÌNH THƯỜNG của một link cũ
 *         chứ không phải sự cố.
 */
export async function fetchOrganizationPreview(joinCode: string): Promise<OrganizationPreview> {
  const response = await apiClient.get(`/organizations/by-code/${encodeURIComponent(joinCode)}`)
  return organizationPreviewResponseSchema.parse(response.data).data.organization
}

/**
 * Input: Tên + tài khoản nhận tiền + hệ số nam + cài đặt chủ tổ chức đã ứng tiền.
 * Output: Tổ chức mới, người gọi là owner.
 *
 *         Cặp bank LUÔN gửi và luôn có chữ: form bắt nhập đủ trước khi submit. BE vẫn để hai
 *         field này tuỳ chọn (chuỗi rỗng ở POST bị từ chối như số tài khoản sai định dạng), nên
 *         nếu sau này bỏ ràng buộc ở form thì phải bỏ cả hai field khỏi body chứ không gửi rỗng.
 *
 *         Parse lại response bằng schema thay vì tin BE: shape sai thì phải nổ ở đây chứ
 *         không phải ở component đọc `organization.joinCode`.
 */
export async function createOrganization(
  payload: CreateOrganizationPayload,
): Promise<Organization> {
  const response = await apiClient.post("/organizations", {
    name: payload.name,
    bankBin: payload.bankBin,
    bankAccountNo: payload.bankAccountNo,
    maleRatio: payload.maleRatio,
    skipOwnerPayment: payload.skipOwnerPayment,
  })
  return organizationResponseSchema.parse(response.data).data.organization
}

/**
 * Input: Mã tham gia đã chuẩn hoá.
 * Output: Tổ chức vừa vào, người gọi là member.
 */
export async function joinOrganizationByCode(
  payload: JoinOrganizationPayload,
): Promise<Organization> {
  const response = await apiClient.post("/organizations/join", payload)
  return organizationResponseSchema.parse(response.data).data.organization
}

/**
 * Input: id tổ chức + trạng thái công tắc mới.
 * Output: Tổ chức sau khi đổi. Chỉ owner gọi được — member gọi sẽ ăn ORG_004 từ BE.
 *
 *         Bật = BE sinh mã MỚI (mã cũ chết hẳn), tắt = BE set mã về null.
 */
export async function updateJoinByCodeEnabled(payload: {
  organizationId: string
  joinByCodeEnabled: boolean
}): Promise<Organization> {
  const response = await apiClient.patch(`/organizations/${payload.organizationId}`, {
    joinByCodeEnabled: payload.joinByCodeEnabled,
  })
  return organizationResponseSchema.parse(response.data).data.organization
}

/**
 * Input: id tổ chức + tên + tài khoản nhận tiền + hệ số nam + cài đặt chủ tổ chức đã ứng tiền.
 * Output: Tổ chức sau khi đổi. Chỉ owner gọi được.
 *
 *         `bankBin`/`bankAccountNo` LUÔN gửi cả cặp: BE hiểu nửa cặp là lỗi. Form bắt nhập đủ
 *         cả hai nên không còn đường gửi cặp rỗng (thứ BE hiểu là "gỡ tài khoản").
 *
 *         KHÔNG gửi kèm `joinByCodeEnabled`: BE coi mỗi field là một ý định riêng, gửi kèm là
 *         vô tình xoay mã tham gia và làm chết mọi liên kết mời đang lưu hành.
 */
export async function updateOrganization(
  payload: { organizationId: string } & EditOrganizationPayload,
): Promise<Organization> {
  const response = await apiClient.patch(`/organizations/${payload.organizationId}`, {
    name: payload.name,
    bankBin: payload.bankBin,
    bankAccountNo: payload.bankAccountNo,
    maleRatio: payload.maleRatio,
    skipOwnerPayment: payload.skipOwnerPayment,
  })
  return organizationResponseSchema.parse(response.data).data.organization
}

/** Tham số của danh sách thành viên. `page` đếm từ 1, `q` rỗng = không tìm gì. */
export type MemberListParams = {
  organizationId: string
  page: number
  pageSize: number
  q?: string
}

/**
 * Input: id tổ chức + trang + từ khoá.
 * Output: Một trang thành viên kèm meta phân trang.
 *
 *         Gọi từ CLIENT (khác fetchOrganizations của layout, chạy trên Next server): đổi trang
 *         và gõ tìm kiếm là chuyện xảy ra liên tục trong cùng một màn hình, để React Query giữ
 *         cache thì quay lại trang cũ không phải chờ mạng.
 *
 *         `q` chỉ gắn vào URL khi có chữ: gửi `q=` rỗng thì BE vẫn hiểu là không lọc, nhưng URL
 *         khác nhau tạo hai entry cache cho cùng một kết quả.
 */
export async function fetchOrganizationMembers(
  params: MemberListParams,
): Promise<{ members: OrganizationMember[]; pagination: Pagination }> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.q) search.set("q", params.q)

  const response = await apiClient.get(
    `/organizations/${params.organizationId}/members?${search.toString()}`,
  )
  return organizationMemberListResponseSchema.parse(response.data).data
}

/**
 * Input: id tổ chức.
 * Output: Bốn con số của trang chủ, của chính người đang đăng nhập.
 *
 *         Một request cho cả bốn: chúng đứng cạnh nhau trên cùng một hàng thẻ, mà bốn request
 *         thì hàng đó hiện ra lệch nhịp từng thẻ một.
 */
export async function fetchOrganizationOverview(
  organizationId: string,
): Promise<OrganizationOverview> {
  const response = await apiClient.get(`/organizations/${organizationId}/overview`)
  return organizationOverviewResponseSchema.parse(response.data).data.overview
}

/**
 * Input: id tổ chức + userId người bị xoá.
 * Output: Không trả gì. MỘT hàm cho hai việc, đúng như BE: `userId` là chính mình = rời tổ
 *         chức, `userId` người khác = owner đuổi thành viên.
 */
export async function removeOrganizationMember(payload: {
  organizationId: string
  userId: string
}): Promise<void> {
  await apiClient.delete(`/organizations/${payload.organizationId}/members/${payload.userId}`)
}

/**
 * Input: id tổ chức.
 * Output: Không trả gì. Chỉ owner gọi được; xoá là mất cả tổ chức và mọi dữ liệu của nó.
 */
export async function deleteOrganization(organizationId: string): Promise<void> {
  await apiClient.delete(`/organizations/${organizationId}`)
}
