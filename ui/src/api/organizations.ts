import { apiClient } from "@/api/client"
import { organizationResponseSchema } from "@/schema/organization"
import type {
  CreateOrganizationPayload,
  JoinOrganizationPayload,
  Organization,
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
