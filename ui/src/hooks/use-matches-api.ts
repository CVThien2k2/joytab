"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import {
  cancelMatch,
  cancelVote,
  createMatch,
  fetchMatch,
  fetchMatchHistory,
  fetchOrganizationMatches,
  fetchSettlement,
  settleMatch,
  updateMatch,
  voteMatch,
  type MatchPayload,
  type MatchRange,
} from "@/api/matches"
import type { SettlementFormPayload } from "@/types/match"

/**
 * Khoá cache của lịch. Khai một chỗ để mutation invalidate đúng thứ query đang giữ.
 *
 * Khoá của một tổ chức KHÔNG chứa khoảng ngày ở gốc: `invalidateQueries` khớp theo tiền tố,
 * nên vote một trận là làm mới mọi tháng đang cache, không riêng tháng đang xem.
 */
export const matchQueryKeys = {
  organization: (organizationId: string) => ["matches", "organization", organizationId] as const,
  organizationRange: (organizationId: string, range?: MatchRange) =>
    [...matchQueryKeys.organization(organizationId), range?.from ?? "", range?.to ?? ""] as const,
  detail: (matchId: string) => ["matches", "detail", matchId] as const,
  history: (matchId: string) => ["matches", "history", matchId] as const,
  settlement: (matchId: string) => ["matches", "settlement", matchId] as const,
}

/**
 * Làm mới MỌI thứ mà một thay đổi trên trận có thể đụng tới: lịch của tổ chức, chi tiết trận,
 * và công nợ.
 *
 * Gom vào một hàm vì mọi mutation ở đây đều phải làm đúng bấy nhiêu — bỏ sót một khoá là
 * người dùng vote xong nhìn thấy số cũ, và đó là kiểu lỗi không ai báo mà ai cũng thấy.
 */
function invalidateMatchData(
  queryClient: ReturnType<typeof useQueryClient>,
  params: { organizationId?: string; matchId?: string },
): void {
  if (params.organizationId) {
    void queryClient.invalidateQueries({
      queryKey: matchQueryKeys.organization(params.organizationId),
    })
  }
  if (params.matchId) {
    void queryClient.invalidateQueries({ queryKey: matchQueryKeys.detail(params.matchId) })
    void queryClient.invalidateQueries({ queryKey: matchQueryKeys.history(params.matchId) })
    void queryClient.invalidateQueries({ queryKey: matchQueryKeys.settlement(params.matchId) })
  }
  void queryClient.invalidateQueries({ queryKey: ["charges"] })
}

/**
 * Input: id tổ chức + khoảng ngày đang xem trên lịch.
 * Output: Query các trận của tổ chức.
 *
 *         `staleTime` 15 giây: số người đã đăng ký đổi theo phút chứ không theo giây, nhưng
 *         ngắn hơn danh sách thành viên vì đây là con số người ta nhìn để quyết định có đi
 *         hay không.
 */
export function useOrganizationMatches(organizationId: string, range?: MatchRange) {
  return useQuery({
    queryKey: matchQueryKeys.organizationRange(organizationId, range),
    queryFn: () => fetchOrganizationMatches({ organizationId, range }),
    staleTime: 15_000,
  })
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: matchQueryKeys.detail(matchId),
    queryFn: () => fetchMatch(matchId),
    staleTime: 15_000,
  })
}

export function useMatchHistory(matchId: string, enabled = true) {
  return useQuery({
    queryKey: matchQueryKeys.history(matchId),
    queryFn: () => fetchMatchHistory(matchId),
    enabled,
    staleTime: 30_000,
  })
}

/**
 * Input: id trận + trận đã chốt chưa.
 * Output: Query bảng chia tiền. Chưa chốt thì KHÔNG gọi: BE trả MATCH_013, và một lỗi đỏ trong
 *         console cho một trạng thái hoàn toàn bình thường là tiếng ồn.
 */
export function useSettlement(matchId: string, settled: boolean) {
  return useQuery({
    queryKey: matchQueryKeys.settlement(matchId),
    queryFn: () => fetchSettlement(matchId),
    enabled: settled,
    staleTime: 30_000,
  })
}

export function useCreateMatch(organizationId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MatchPayload) => createMatch({ organizationId, payload }),
    onSuccess: (match) => {
      toast.success(`Đã tạo lịch tại ${match.courtName}`)
      onSuccess?.()
      invalidateMatchData(queryClient, { organizationId })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không tạo được lịch. Vui lòng thử lại."))
    },
  })
}

/**
 * Input: id tổ chức + callback sau khi lưu xong.
 * Output: Mutation sửa trận — dùng cho cả form sửa lẫn thao tác kéo thả trên lịch.
 *
 *         Kéo thả cần hoàn tác chip khi server từ chối, nhưng hàm `revert` chỉ tồn tại trong
 *         đúng lần kéo đó — nên chỗ gọi truyền `onError` theo từng lần `mutate`, không khai
 *         sẵn ở đây.
 */
export function useUpdateMatch(
  organizationId: string,
  options?: { onSuccess?: () => void; silent?: boolean },
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { matchId: string; payload: Partial<MatchPayload> }) =>
      updateMatch(params),
    onSuccess: (match) => {
      if (!options?.silent) toast.success("Đã cập nhật lịch thi đấu")
      options?.onSuccess?.()
      invalidateMatchData(queryClient, { organizationId, matchId: match.id })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không cập nhật được lịch. Vui lòng thử lại."))
    },
  })
}

export function useCancelMatch(organizationId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (matchId: string) => cancelMatch(matchId),
    onSuccess: (_data, matchId) => {
      toast.success("Đã huỷ trận đấu")
      onSuccess?.()
      invalidateMatchData(queryClient, { organizationId, matchId })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không huỷ được trận. Vui lòng thử lại."))
    },
  })
}

/**
 * Input: id tổ chức (có thể không biết khi gọi từ lịch cá nhân).
 * Output: Mutation vote / huỷ vote.
 *
 *         Một hook cho hai chiều vì chúng luôn đi cùng nhau trên cùng một cái nút, và cùng
 *         phải làm mới đúng bấy nhiêu cache.
 */
export function useVoteMatch(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { matchId: string; join: boolean }) =>
      params.join ? voteMatch(params.matchId) : cancelVote(params.matchId),
    onSuccess: (_data, params) => {
      toast.success(params.join ? "Đã đăng ký tham gia" : "Đã huỷ đăng ký")
      invalidateMatchData(queryClient, { organizationId, matchId: params.matchId })
    },
    onError: (error, params) => {
      toast.error(
        getApiErrorMessage(
          error,
          params.join
            ? "Không đăng ký được. Vui lòng thử lại."
            : "Không huỷ được. Vui lòng thử lại.",
        ),
      )
    },
  })
}

/**
 * Input: id tổ chức + id trận.
 * Output: Mutation chốt chi phí. Gọi lại được để sửa, miễn chưa ai gửi thanh toán (BE chặn).
 */
export function useSettleMatch(organizationId: string, matchId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SettlementFormPayload) => settleMatch({ matchId, payload }),
    onSuccess: () => {
      toast.success("Đã chốt chi phí và chia tiền")
      onSuccess?.()
      invalidateMatchData(queryClient, { organizationId, matchId })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không chốt được chi phí. Vui lòng thử lại."))
    },
  })
}
