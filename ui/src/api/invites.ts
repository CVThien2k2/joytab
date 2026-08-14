import { apiClient } from "@/api/client"
import {
  acceptInviteResponseSchema,
  createdInviteResponseSchema,
  inviteListResponseSchema,
  invitePreviewResponseSchema,
  inviteResponseSchema,
} from "@/schema/organization"
import type {
  AcceptInviteResult,
  CreatedInvite,
  Invite,
  InvitePreview,
} from "@/types/organization"

/**
 * Input: orgId và tuỳ chọn hạn dùng / số lượt.
 * Output: Link mời kèm token thô — chỉ thấy được đúng lần này, BE chỉ lưu SHA-256.
 */
export async function createInvite(
  orgId: string,
  input: { expiresInDays?: number; maxUses?: number },
): Promise<CreatedInvite> {
  const response = await apiClient.post(`/organizations/${orgId}/invites`, input)
  return createdInviteResponseSchema.parse(response.data).data
}

/**
 * Input: orgId.
 * Output: Danh sách link mời (không kèm token).
 */
export async function fetchInvites(orgId: string): Promise<Invite[]> {
  const response = await apiClient.get(`/organizations/${orgId}/invites`)
  return inviteListResponseSchema.parse(response.data).data
}

/**
 * Input: orgId và id link mời.
 * Output: Thu hồi link.
 */
export async function revokeInvite(
  orgId: string,
  inviteId: string,
): Promise<Invite> {
  const response = await apiClient.delete(
    `/organizations/${orgId}/invites/${inviteId}`,
  )
  return inviteResponseSchema.parse(response.data).data
}

/**
 * Input: Token trên URL. Endpoint public — người chưa đăng nhập vẫn gọi được.
 * Output: Tên nhóm + link còn dùng được hay không.
 */
export async function fetchInvitePreview(
  token: string,
): Promise<InvitePreview> {
  const response = await apiClient.get(`/invites/${token}`)
  return invitePreviewResponseSchema.parse(response.data).data
}

/**
 * Input: Token trên URL (cần đã đăng nhập).
 * Output: `{ organizationId, alreadyMember }` để điều hướng thẳng vào nhóm.
 */
export async function acceptInvite(
  token: string,
): Promise<AcceptInviteResult> {
  const response = await apiClient.post(`/invites/${token}/accept`)
  return acceptInviteResponseSchema.parse(response.data).data
}
