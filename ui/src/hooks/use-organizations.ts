"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createOrganization,
  fetchMembers,
  fetchOrganization,
  fetchOrganizations,
  leaveOrganization,
  removeMember,
  updateMemberRole,
  updateOrganization,
} from "@/api/organizations"
import { getErrorMessage } from "@/lib/error-code"
import { queryKeys } from "@/hooks/query-keys"
import type { MemberRole } from "@/types/organization"

/**
 * Input: Không có.
 * Output: Danh sách nhóm tôi tham gia — dùng cho trang chủ và org switcher.
 */
export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.orgs(),
    queryFn: fetchOrganizations,
  })
}

/**
 * Input: orgId.
 * Output: Chi tiết nhóm. `myRole` ở đây quyết định menu nào hiện ra.
 */
export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: queryKeys.org(orgId),
    queryFn: () => fetchOrganization(orgId),
    enabled: Boolean(orgId),
  })
}

/**
 * Input: Không có.
 * Output: Tạo nhóm rồi điều hướng thẳng vào nhóm vừa tạo.
 */
export function useCreateOrganization() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createOrganization,
    onSuccess: async (organization) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orgs() })
      toast.success("Đã tạo nhóm")
      router.push(`/orgs/${organization.id}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: orgId.
 * Output: Đổi tên nhóm.
 */
export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string }) => updateOrganization(orgId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orgs() }),
      ])
      toast.success("Đã cập nhật nhóm")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: orgId.
 * Output: Danh sách thành viên đang hoạt động.
 */
export function useMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.members(orgId),
    queryFn: () => fetchMembers(orgId),
    enabled: Boolean(orgId),
  })
}

/**
 * Input: orgId.
 * Output: Đổi quyền thành viên. Hạ ADMIN cuối cùng sẽ bị BE chặn bằng ORG_004.
 */
export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      updateMemberRole(orgId, userId, role),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId) }),
      ])
      toast.success("Đã đổi quyền")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: orgId.
 * Output: Mời một thành viên ra khỏi nhóm.
 */
export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeMember(orgId, userId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId) }),
      ])
      toast.success("Đã xoá thành viên khỏi nhóm")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: orgId.
 * Output: Tự rời nhóm rồi về trang chủ.
 */
export function useLeaveOrganization(orgId: string) {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => leaveOrganization(orgId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orgs() })
      toast.success("Đã rời nhóm")
      router.push("/")
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, {
          ORG_004: "Bạn là quản trị viên cuối cùng — trao quyền cho người khác trước đã",
        }),
      ),
  })
}
