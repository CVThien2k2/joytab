"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import {
  cancelMatch,
  cancelVote,
  createMatch,
  fetchMatch,
  fetchMatchHistory,
  fetchOrganizationMatchHistory,
  fetchOrganizationUpcomingMatches,
  fetchSettlement,
  settleMatch,
  updateMatch,
  voteMatch,
  type MatchHistoryFilters,
  type MatchPayload,
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
  /**
   * Lịch sử của một tổ chức, lồng DƯỚI khoá tổ chức chứ không đứng riêng: chốt tiền hay trả
   * tiền xong là các mutation hiện có đã invalidate đúng tiền tố đó (kể cả bên
   * use-payments-api), nên danh sách lịch sử tự mới lại mà không phải thêm khoá vào hai chỗ.
   */
  organizationHistory: (organizationId: string, filters: MatchHistoryFilters) =>
    [...matchQueryKeys.organization(organizationId), "history", filters] as const,
  /** Buổi sắp diễn ra — cũng lồng dưới khoá tổ chức nên mọi mutation hiện có tự làm mới nó. */
  organizationUpcoming: (organizationId: string) =>
    [...matchQueryKeys.organization(organizationId), "upcoming"] as const,
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
  // Bốn con số ở trang chủ đếm chính những thứ vừa đổi (buổi sắp tới, buổi đã chốt, tiền).
  void queryClient.invalidateQueries({ queryKey: ["organizations", "overview"] })
}

/**
 * Input: id tổ chức.
 * Output: Query cuộn vô hạn các buổi chưa kết thúc, sớm nhất trước.
 *
 *         Cuộn theo cursor chứ không lấy hết một lượt: một tổ chức đá đều thì lịch phía trước
 *         có thể dài hàng trăm buổi, mà màn hình đầu chỉ hiện được vài dòng.
 *
 *         `staleTime` 15 giây, bằng với lịch theo khoảng ngày: sĩ số và "mình đã đăng ký chưa"
 *         là hai con số người ta nhìn để quyết định có đi hay không.
 */
export function useOrganizationUpcomingMatches(organizationId: string) {
  return useInfiniteQuery({
    queryKey: matchQueryKeys.organizationUpcoming(organizationId),
    queryFn: ({ pageParam }) =>
      fetchOrganizationUpcomingMatches({ organizationId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
  })
}

/**
 * Input: id tổ chức + bộ lọc của tab Lịch sử.
 * Output: Query cuộn vô hạn — mỗi `fetchNextPage` là một lô nối sau lô trước.
 *
 *         Bộ lọc nằm TRONG queryKey, nên đổi filter là react-query tự bắt đầu lại từ lô đầu:
 *         không có bước "reset về trang 1" nào phải nhớ gọi bằng tay.
 *
 *         `staleTime` 30 giây, dài hơn lịch sắp tới (15s): trận đã chốt tiền hay đã huỷ thì
 *         gần như không đổi nữa, chỉ trạng thái trả tiền của mình là còn động.
 */
export function useOrganizationMatchHistory(organizationId: string, filters: MatchHistoryFilters) {
  return useInfiniteQuery({
    queryKey: matchQueryKeys.organizationHistory(organizationId, filters),
    queryFn: ({ pageParam }) =>
      fetchOrganizationMatchHistory({ organizationId, filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

/**
 * Input: id trận + có gọi hay không.
 * Output: Query chi tiết một trận (summary + danh sách người tham gia đầy đủ).
 *
 *         `enabled` để hộp thoại xem nhanh chỉ hỏi khi nó thật sự mở: component đó vẫn nằm
 *         trong cây sau khi đóng (còn giữ trận vừa xem để chạy animation ra), mà đóng rồi thì
 *         không có gì để tải nữa.
 */
export function useMatch(matchId: string, enabled = true) {
  return useQuery({
    queryKey: matchQueryKeys.detail(matchId),
    queryFn: () => fetchMatch(matchId),
    enabled: enabled && Boolean(matchId),
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
 * Output: Mutation sửa trận.
 */
export function useUpdateMatch(organizationId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { matchId: string; payload: Partial<MatchPayload> }) =>
      updateMatch(params),
    onSuccess: (match) => {
      toast.success("Đã cập nhật lịch thi đấu")
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
