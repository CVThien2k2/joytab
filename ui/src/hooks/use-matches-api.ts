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
  fetchOrganizationHistory,
  fetchOrganizationMatchHistory,
  fetchOrganizationUpcomingMatches,
  fetchSettlement,
  settleMatch,
  updateMatch,
  voteMatch,
  type MatchHistoryFilters,
  type MatchPayload,
} from "@/api/matches"
import type { MatchDetail, OrganizationHistoryScope, SettlementFormPayload } from "@/types/match"

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
  /**
   * Sổ lịch sử của CẢ tổ chức. Cũng lồng dưới khoá tổ chức, cùng lý do như trên: owner chốt
   * giá xong là danh sách "chưa chốt giá" phải tự ngắn đi, mà mutation chốt giá thì đã
   * invalidate đúng tiền tố đó rồi.
   */
  organizationOwnHistory: (organizationId: string, scope: OrganizationHistoryScope) =>
    [...matchQueryKeys.organization(organizationId), "org-history", scope] as const,
  /** Buổi sắp diễn ra — cũng lồng dưới khoá tổ chức nên mọi mutation hiện có tự làm mới nó. */
  organizationUpcoming: (organizationId: string) =>
    [...matchQueryKeys.organization(organizationId), "upcoming"] as const,
  detail: (matchId: string) => ["matches", "detail", matchId] as const,
  history: (matchId: string) => ["matches", "history", matchId] as const,
  settlement: (matchId: string) => ["matches", "settlement", matchId] as const,
}

/** Chi tiết trận coi như còn tươi trong 15 giây — dùng chung cho cả `useMatch` lẫn `useFetchMatch`. */
const MATCH_DETAIL_STALE_TIME = 15_000

/**
 * Làm mới MỌI thứ mà một thay đổi trên trận có thể đụng tới: lịch của tổ chức, chi tiết trận,
 * và công nợ.
 *
 * Gom vào một hàm vì mọi mutation ở đây đều phải làm đúng bấy nhiêu — bỏ sót một khoá là
 * người dùng vote xong nhìn thấy số cũ, và đó là kiểu lỗi không ai báo mà ai cũng thấy.
 */
function invalidateMatchData(
  queryClient: ReturnType<typeof useQueryClient>,
  params: {
    organizationId?: string
    matchId?: string
    /**
     * Bỏ qua bốn con số ở trang chủ. Chỉ ĐĂNG KÝ / HUỶ ĐĂNG KÝ dùng cờ này.
     *
     * Bốn con số đó đếm tiền của mình (chưa trả / đã trả), số buổi đã CHỐT TIỀN mình có mặt, và
     * số buổi chưa diễn ra của tổ chức — không con số nào đổi khi thêm hay bớt một người trong
     * một buổi. Còn tạo / sửa giờ / huỷ / chốt tiền thì đều đụng tới, nên chúng KHÔNG bỏ qua.
     *
     * Cờ mặc định tắt (tức là vẫn làm mới) có chủ đích: quên bật cờ chỉ tốn một request thừa,
     * còn quên tắt là một con số đứng im mà không ai giải thích được.
     */
    skipOverview?: boolean
  },
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
  if (!params.skipOverview) {
    // Bốn con số ở trang chủ đếm chính những thứ vừa đổi (buổi sắp tới, buổi đã chốt, tiền).
    void queryClient.invalidateQueries({ queryKey: ["organizations", "overview"] })
  }
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
 * Input: id tổ chức + lát cắt đang chọn.
 * Output: Query cuộn vô hạn sổ lịch sử của cả tổ chức. CHỈ owner gọi (BE trả ORG_004).
 *
 *         Lát cắt nằm TRONG queryKey nên đổi tab là bắt đầu lại từ lô đầu — không có bước
 *         reset nào phải nhớ gọi bằng tay, giống hệt sổ cá nhân.
 *
 *         `staleTime` 30 giây, bằng sổ cá nhân: cùng một loại dữ liệu gần như đứng yên.
 */
export function useOrganizationHistory(organizationId: string, scope: OrganizationHistoryScope) {
  return useInfiniteQuery({
    queryKey: matchQueryKeys.organizationOwnHistory(organizationId, scope),
    queryFn: ({ pageParam }) =>
      fetchOrganizationHistory({ organizationId, scope, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

/**
 * Input: id trận + có gọi hay không.
 * Output: Query chi tiết trận.
 *
 *         `enabled` để breadcrumb dùng được: hook không gọi có điều kiện được, mà breadcrumb
 *         thì chạy ở MỌI trang — nó phải gọi hook này ngay cả khi đang đứng ở một route không
 *         có `matchId` nào.
 *
 *         Cùng queryKey với trang chi tiết nên hai chỗ dùng CHUNG một request: breadcrumb đọc
 *         tên sân từ đúng cache mà trang đang chờ, không sinh thêm một lượt gọi.
 */
export function useMatch(matchId: string, enabled = true) {
  return useQuery({
    queryKey: matchQueryKeys.detail(matchId),
    queryFn: () => fetchMatch(matchId),
    enabled,
    staleTime: MATCH_DETAIL_STALE_TIME,
  })
}

/**
 * Input: Không có.
 * Output: Hàm nạp chi tiết một trận THEO YÊU CẦU, trả về promise.
 *
 *         `useMatch` là query khai báo: dựng hook lên là có request. Chỗ nào chỉ cần chi tiết
 *         SAU KHI người dùng bấm — nút "Chốt giá" trên từng dòng danh sách — thì dùng hàm này:
 *         cùng `queryKey` và cùng `staleTime` nên dữ liệu vẫn nằm chung một chỗ với `useMatch`,
 *         chỉ khác ở thời điểm gọi. Một danh sách 20 dòng vì vậy không sinh 20 request cho một
 *         việc người ta làm mỗi lần một buổi.
 */
export function useFetchMatch(): (matchId: string) => Promise<MatchDetail> {
  const queryClient = useQueryClient()

  return (matchId) =>
    queryClient.fetchQuery({
      queryKey: matchQueryKeys.detail(matchId),
      queryFn: () => fetchMatch(matchId),
      staleTime: MATCH_DETAIL_STALE_TIME,
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
 *
 *         Đây là mutation DUY NHẤT không đụng tới bốn con số ở trang chủ (`skipOverview`): vào
 *         hay ra một buổi không đổi tiền của mình, cũng không đổi số buổi đã chốt hay số buổi
 *         sắp tới. Mà nó lại là mutation người ta bấm nhiều nhất.
 */
export function useVoteMatch(organizationId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { matchId: string; join: boolean }) =>
      params.join ? voteMatch(params.matchId) : cancelVote(params.matchId),
    onSuccess: (_data, params) => {
      toast.success(params.join ? "Đã đăng ký tham gia" : "Đã huỷ đăng ký")
      invalidateMatchData(queryClient, {
        organizationId,
        matchId: params.matchId,
        skipOverview: true,
      })
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
