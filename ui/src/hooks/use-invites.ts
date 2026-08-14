"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  acceptInvite,
  createInvite,
  fetchInvitePreview,
  fetchInvites,
  revokeInvite,
} from "@/api/invites"
import { getErrorMessage } from "@/lib/error-code"
import { queryKeys } from "@/hooks/query-keys"

/**
 * Input: orgId.
 * Output: Danh sách link mời của nhóm.
 */
export function useInvites(orgId: string) {
  return useQuery({
    queryKey: queryKeys.invites(orgId),
    queryFn: () => fetchInvites(orgId),
    enabled: Boolean(orgId),
  })
}

/**
 * Input: orgId.
 * Output: Tạo link mời. Token thô nằm trong `data.url` và CHỈ có ở response này — màn hình
 *         gọi phải hiện link ra ngay, không có đường lấy lại.
 */
export function useCreateInvite(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { expiresInDays?: number; maxUses?: number }) =>
      createInvite(orgId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites(orgId) })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: orgId.
 * Output: Thu hồi link mời.
 */
export function useRevokeInvite(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(orgId, inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invites(orgId) })
      toast.success("Đã thu hồi link mời")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: Token trên URL.
 * Output: Tên nhóm + link còn hiệu lực hay không. Không retry: token sai thì thử lại vô nghĩa.
 */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: queryKeys.invitePreview(token),
    queryFn: () => fetchInvitePreview(token),
    enabled: Boolean(token),
    retry: false,
  })
}

/**
 * Input: Token trên URL.
 * Output: Tham gia nhóm. Caller tự điều hướng vì trang mời nằm ngoài layout private.
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orgs() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
