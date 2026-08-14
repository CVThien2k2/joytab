import { apiClient } from "@/api/client"
import {
  memberListResponseSchema,
  memberResponseSchema,
  organizationListResponseSchema,
  organizationResponseSchema,
  removeMemberResponseSchema,
} from "@/schema/organization"
import type { Member, MemberRole, Organization } from "@/types/organization"

/**
 * Input: Không có.
 * Output: Các nhóm tôi đang tham gia.
 */
export async function fetchOrganizations(): Promise<Organization[]> {
  const response = await apiClient.get("/organizations")
  return organizationListResponseSchema.parse(response.data).data
}

/**
 * Input: orgId.
 * Output: Chi tiết nhóm kèm `myRole` — FE dùng nó để ẩn/hiện menu ADMIN.
 */
export async function fetchOrganization(orgId: string): Promise<Organization> {
  const response = await apiClient.get(`/organizations/${orgId}`)
  return organizationResponseSchema.parse(response.data).data
}

/**
 * Input: Tên nhóm.
 * Output: Nhóm vừa tạo; người tạo tự động là ADMIN.
 */
export async function createOrganization(input: {
  name: string
}): Promise<Organization> {
  const response = await apiClient.post("/organizations", input)
  return organizationResponseSchema.parse(response.data).data
}

/**
 * Input: orgId và tên mới.
 * Output: Nhóm sau khi đổi tên.
 */
export async function updateOrganization(
  orgId: string,
  input: { name: string },
): Promise<Organization> {
  const response = await apiClient.patch(`/organizations/${orgId}`, input)
  return organizationResponseSchema.parse(response.data).data
}

/**
 * Input: orgId.
 * Output: Danh sách thành viên đang hoạt động.
 */
export async function fetchMembers(orgId: string): Promise<Member[]> {
  const response = await apiClient.get(`/organizations/${orgId}/members`)
  return memberListResponseSchema.parse(response.data).data
}

/**
 * Input: orgId, userId và role mới.
 * Output: Thành viên sau khi đổi quyền.
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: MemberRole,
): Promise<Member> {
  const response = await apiClient.patch(
    `/organizations/${orgId}/members/${userId}`,
    { role },
  )
  return memberResponseSchema.parse(response.data).data
}

/**
 * Input: orgId và userId.
 * Output: Mời thành viên ra khỏi nhóm.
 */
export async function removeMember(
  orgId: string,
  userId: string,
): Promise<{ userId: string }> {
  const response = await apiClient.delete(
    `/organizations/${orgId}/members/${userId}`,
  )
  return removeMemberResponseSchema.parse(response.data).data
}

/**
 * Input: orgId.
 * Output: Tự rời nhóm. ADMIN cuối cùng phải trao quyền trước (ORG_004).
 */
export async function leaveOrganization(
  orgId: string,
): Promise<{ userId: string }> {
  const response = await apiClient.post(`/organizations/${orgId}/leave`)
  return removeMemberResponseSchema.parse(response.data).data
}
