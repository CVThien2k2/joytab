import { apiClient } from "@/api/client"
import {
  organizationMemberListResponseSchema,
  organizationResponseSchema,
} from "@/schema/organization"
import type {
  CreateOrganizationPayload,
  JoinOrganizationPayload,
  Organization,
  OrganizationMember,
  Pagination,
} from "@/types/organization"

/**
 * Input: Tên tổ chức đã qua validate.
 * Output: Tổ chức mới, người gọi là owner.
 *
 *         Parse lại response bằng schema thay vì tin BE: shape sai thì phải nổ ở đây chứ
 *         không phải ở component đọc `organization.joinCode`.
 */
export async function createOrganization(
  payload: CreateOrganizationPayload,
): Promise<Organization> {
  const response = await apiClient.post("/organizations", payload)
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
