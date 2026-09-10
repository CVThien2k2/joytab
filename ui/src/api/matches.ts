import { apiClient } from "@/api/client"
import {
  matchDetailResponseSchema,
  matchPageResponseSchema,
  matchHistoryResponseSchema,
  matchResponseSchema,
  matchSettlementResponseSchema,
  organizationHistoryPageResponseSchema,
} from "@/schema/match"
import type {
  ChargePaymentStatus,
  MatchDetail,
  MatchSettlement,
  MatchStatus,
  MatchSummary,
  MatchVoteEvent,
  OrganizationHistoryMatch,
  OrganizationHistoryScope,
  SettlementFormPayload,
} from "@/types/match"

/** Body tạo/sửa lịch — đã ghép ngày + giờ thành ISO ở tầng gọi. */
export type MatchPayload = {
  courtName: string
  address?: string
  startAt: string
  endAt: string
  maxPlayers: number
  maleRatio?: number
  note?: string
}

/**
 * Bộ lọc của tab Lịch sử. Mảng rỗng / không có = không lọc theo trục đó.
 *
 * `to` là biên MỞ: chỗ gọi phải quy về 0h ngày hôm sau ngày người dùng chọn, nếu không thì
 * "đến 30/8" sẽ cắt mất chính các buổi trong ngày 30/8.
 */
export type MatchHistoryFilters = {
  from?: string
  to?: string
  status?: MatchStatus[]
  paymentStatus?: ChargePaymentStatus[]
}

/** Một lô trận. `nextCursor = null` là đã hết, không còn gì để cuộn thêm. */
export type MatchPage = {
  matches: MatchSummary[]
  nextCursor: string | null
}

/**
 * Input: id tổ chức + bộ lọc + mốc cuộn của lô trước (`undefined` cho lô đầu).
 * Output: Một lô trận đã chốt tiền / đã huỷ, mới nhất trước.
 *
 *         Tự dựng query bằng `URLSearchParams` chứ không đưa mảng cho axios: axios serialize
 *         mảng thành `status[]=a&status[]=b`, mà cặp ngoặc đó chỉ được gom lại thành mảng nếu
 *         BE đang dùng query parser `extended`. Lặp key trần (`status=a&status=b`) thì parser
 *         nào cũng ra mảng.
 */
export async function fetchOrganizationMatchHistory(params: {
  organizationId: string
  filters: MatchHistoryFilters
  cursor?: string
}): Promise<MatchPage> {
  const search = new URLSearchParams()
  if (params.filters.from) search.set("from", params.filters.from)
  if (params.filters.to) search.set("to", params.filters.to)
  for (const status of params.filters.status ?? []) search.append("status", status)
  for (const status of params.filters.paymentStatus ?? []) search.append("paymentStatus", status)
  if (params.cursor) search.set("cursor", params.cursor)

  const query = search.toString()
  const response = await apiClient.get(
    `/organizations/${params.organizationId}/matches/history${query ? `?${query}` : ""}`,
  )
  return matchPageResponseSchema.parse(response.data).data
}

/** Một lô trận trong sổ của tổ chức. Cùng hình dạng `MatchPage`, chỉ giàu hơn ở mỗi dòng. */
export type OrganizationHistoryPage = {
  matches: OrganizationHistoryMatch[]
  nextCursor: string | null
}

/**
 * Input: id tổ chức + lát cắt + mốc cuộn của lô trước (`undefined` cho lô đầu).
 * Output: Một lô lịch sử của CẢ tổ chức, mới nhất trước.
 *
 *         CHỈ owner gọi được (BE trả ORG_004). Khác `fetchOrganizationMatchHistory`: hàm kia
 *         là sổ của chính người hỏi và lọc theo khoản của họ, còn đây là sổ điều hành — mọi
 *         buổi của tổ chức, kèm tổng tiền và tiến độ thu của từng buổi.
 */
export async function fetchOrganizationHistory(params: {
  organizationId: string
  scope: OrganizationHistoryScope
  cursor?: string
}): Promise<OrganizationHistoryPage> {
  const search = new URLSearchParams()
  // `all` là mặc định của BE nên không cần gửi — bớt một tham số trên URL, và cũng là cách
  // nói rằng lát cắt mặc định do BE định nghĩa chứ không phải hai nơi cùng giữ.
  if (params.scope !== "all") search.set("scope", params.scope)
  if (params.cursor) search.set("cursor", params.cursor)

  const query = search.toString()
  const response = await apiClient.get(
    `/organizations/${params.organizationId}/matches/org-history${query ? `?${query}` : ""}`,
  )
  return organizationHistoryPageResponseSchema.parse(response.data).data
}

/**
 * Input: id tổ chức + mốc cuộn của lô trước (`undefined` cho lô đầu).
 * Output: Một lô buổi CHƯA KẾT THÚC của tổ chức, sớm nhất trước.
 *
 *         Khác `fetchOrganizationMatches` (nhận khoảng ngày, trả hết một lượt, trần 92 ngày):
 *         đây là "mọi buổi phía trước", cuộn tới đâu tải tới đó nên xa mấy cũng tới được.
 */
export async function fetchOrganizationUpcomingMatches(params: {
  organizationId: string
  cursor?: string
}): Promise<MatchPage> {
  const query = params.cursor ? `?cursor=${encodeURIComponent(params.cursor)}` : ""
  const response = await apiClient.get(
    `/organizations/${params.organizationId}/matches/upcoming${query}`,
  )
  return matchPageResponseSchema.parse(response.data).data
}

export async function fetchMatch(matchId: string): Promise<MatchDetail> {
  const response = await apiClient.get(`/matches/${matchId}`)
  return matchDetailResponseSchema.parse(response.data).data.match
}

export async function createMatch(params: {
  organizationId: string
  payload: MatchPayload
}): Promise<MatchSummary> {
  const response = await apiClient.post(
    `/organizations/${params.organizationId}/matches`,
    params.payload,
  )
  return matchResponseSchema.parse(response.data).data.match
}

/**
 * Input: id trận + các field cần đổi.
 * Output: Trận sau khi đổi.
 *
 *         Cũng là API của thao tác kéo thả trên lịch (chỉ gửi startAt/endAt) — chỗ gọi phải
 *         hoàn tác chip về vị trí cũ khi hàm này ném lỗi.
 */
export async function updateMatch(params: {
  matchId: string
  payload: Partial<MatchPayload>
}): Promise<MatchSummary> {
  const response = await apiClient.patch(`/matches/${params.matchId}`, params.payload)
  return matchResponseSchema.parse(response.data).data.match
}

/** Huỷ MỀM: trận chuyển sang 'canceled', không biến mất khỏi lịch sử. */
export async function cancelMatch(matchId: string): Promise<void> {
  await apiClient.delete(`/matches/${matchId}`)
}

export async function voteMatch(matchId: string): Promise<void> {
  await apiClient.post(`/matches/${matchId}/vote`)
}

export async function cancelVote(matchId: string): Promise<void> {
  await apiClient.delete(`/matches/${matchId}/vote`)
}

export async function fetchMatchHistory(matchId: string): Promise<MatchVoteEvent[]> {
  const response = await apiClient.get(`/matches/${matchId}/history`)
  return matchHistoryResponseSchema.parse(response.data).data.events
}

export async function fetchSettlement(matchId: string): Promise<MatchSettlement> {
  const response = await apiClient.get(`/matches/${matchId}/settlement`)
  return matchSettlementResponseSchema.parse(response.data).data.settlement
}

/**
 * Input: id trận + hệ số nam + TOÀN BỘ danh sách chi phí.
 * Output: Bảng chia tiền BE tính lại và đã lưu.
 *
 *         Gửi cả danh sách mỗi lần vì chốt lại là ghi đè cả bảng. Số tiền hiển thị ở màn
 *         preview là do FE tính; con số THẬT luôn là con số trong response này.
 */
export async function settleMatch(params: {
  matchId: string
  payload: SettlementFormPayload
}): Promise<MatchSettlement> {
  const response = await apiClient.post(`/matches/${params.matchId}/settlement`, params.payload)
  return matchSettlementResponseSchema.parse(response.data).data.settlement
}
