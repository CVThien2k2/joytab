import { apiClient } from "@/api/client"
import {
  matchDetailResponseSchema,
  matchHistoryResponseSchema,
  matchListResponseSchema,
  matchResponseSchema,
  matchSettlementResponseSchema,
} from "@/schema/match"
import type {
  MatchDetail,
  MatchSettlement,
  MatchSummary,
  MatchVoteEvent,
  SettlementFormPayload,
} from "@/types/match"

/** Khoảng ngày của bộ lịch. Cả hai đều ISO 8601; không gửi thì BE tự lấy quanh hôm nay. */
export type MatchRange = { from?: string; to?: string }

/** Body tạo/sửa lịch — đã ghép ngày + giờ thành ISO ở tầng gọi. */
export type MatchPayload = {
  courtName: string
  startAt: string
  endAt: string
  maxPlayers: number
  maleRatio?: number
  note?: string
}

/**
 * Input: id tổ chức + khoảng ngày.
 * Output: Các trận của tổ chức, sớm nhất trước. Gồm cả trận đã huỷ để lịch hiện chúng mờ đi.
 *
 *         Parse lại bằng schema thay vì tin BE: shape sai phải nổ ở đây, không phải ở chỗ
 *         component đọc `match.playerCount`.
 */
export async function fetchOrganizationMatches(params: {
  organizationId: string
  range?: MatchRange
}): Promise<MatchSummary[]> {
  const response = await apiClient.get(`/organizations/${params.organizationId}/matches`, {
    params: params.range,
  })
  return matchListResponseSchema.parse(response.data).data.matches
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
