import { apiClient } from "@/api/client"
import {
  deleteTemplateResponseSchema,
  eventDetailResponseSchema,
  eventListResponseSchema,
  eventSummaryResponseSchema,
  eventTemplateListResponseSchema,
  eventTemplateResponseSchema,
  finalizeResultResponseSchema,
  generateResultResponseSchema,
  markAttendedResponseSchema,
  reopenResultResponseSchema,
  voteResultResponseSchema,
} from "@/schema/event"
import type {
  AttendanceStatus,
  EventDetail,
  EventStatus,
  EventSummary,
  EventTemplate,
  ExtraCost,
  FinalizeResult,
  VoteResult,
} from "@/types/event"

export type TemplateInput = {
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string
  locationName?: string
  courtCost: number
  maxParticipants: number
  voteLockMinutesBefore: number
  active?: boolean
}

export type EventInput = {
  title: string
  startAt: string
  endAt: string
  locationName?: string
  courtCost: number
  extraCosts?: ExtraCost[]
  maxParticipants: number
  voteLockMinutesBefore: number
}

export type EventListFilters = {
  status?: EventStatus
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

// ===== Lịch định kỳ =====

/**
 * Input: orgId.
 * Output: Danh sách lịch định kỳ hàng tuần.
 */
export async function fetchTemplates(orgId: string): Promise<EventTemplate[]> {
  const response = await apiClient.get(`/organizations/${orgId}/templates`)
  return eventTemplateListResponseSchema.parse(response.data).data
}

/**
 * Input: orgId + cấu hình lịch.
 * Output: Lịch định kỳ mới; cron sẽ tự sinh buổi đánh từ nó.
 */
export async function createTemplate(
  orgId: string,
  input: TemplateInput,
): Promise<EventTemplate> {
  const response = await apiClient.post(
    `/organizations/${orgId}/templates`,
    input,
  )
  return eventTemplateResponseSchema.parse(response.data).data
}

/**
 * Input: orgId, id lịch và field cần đổi.
 * Output: Lịch sau khi cập nhật. Buổi đã sinh không bị ảnh hưởng.
 */
export async function updateTemplate(
  orgId: string,
  templateId: string,
  input: Partial<TemplateInput>,
): Promise<EventTemplate> {
  const response = await apiClient.patch(
    `/organizations/${orgId}/templates/${templateId}`,
    input,
  )
  return eventTemplateResponseSchema.parse(response.data).data
}

/**
 * Input: orgId và id lịch.
 * Output: Xoá lịch định kỳ; buổi đã sinh vẫn còn.
 */
export async function deleteTemplate(
  orgId: string,
  templateId: string,
): Promise<{ id: string }> {
  const response = await apiClient.delete(
    `/organizations/${orgId}/templates/${templateId}`,
  )
  return deleteTemplateResponseSchema.parse(response.data).data
}

/**
 * Input: orgId và id lịch.
 * Output: Sinh bù buổi đánh cho 14 ngày tới. Bấm nhiều lần không đẻ trùng.
 */
export async function generateFromTemplate(
  orgId: string,
  templateId: string,
): Promise<{ templateId: string; created: number }> {
  const response = await apiClient.post(
    `/organizations/${orgId}/templates/${templateId}/generate`,
  )
  return generateResultResponseSchema.parse(response.data).data
}

// ===== Buổi đánh =====

/**
 * Input: orgId + bộ lọc.
 * Output: Danh sách buổi đánh đã phân trang.
 */
export async function fetchEvents(orgId: string, filters: EventListFilters) {
  const response = await apiClient.get(`/organizations/${orgId}/events`, {
    params: filters,
  })
  return eventListResponseSchema.parse(response.data).data
}

/**
 * Input: orgId + thông tin buổi đánh lẻ.
 * Output: Buổi đánh mới.
 */
export async function createEvent(
  orgId: string,
  input: EventInput,
): Promise<EventSummary> {
  const response = await apiClient.post(`/organizations/${orgId}/events`, input)
  return eventSummaryResponseSchema.parse(response.data).data
}

/**
 * Input: eventId.
 * Output: Chi tiết + danh sách bình chọn + bình chọn của tôi.
 */
export async function fetchEvent(eventId: string): Promise<EventDetail> {
  const response = await apiClient.get(`/events/${eventId}`)
  return eventDetailResponseSchema.parse(response.data).data
}

/**
 * Input: eventId + field cần đổi.
 * Output: Buổi đánh sau khi cập nhật.
 */
export async function updateEvent(
  eventId: string,
  input: Partial<EventInput>,
): Promise<EventSummary> {
  const response = await apiClient.patch(`/events/${eventId}`, input)
  return eventSummaryResponseSchema.parse(response.data).data
}

/**
 * Input: eventId.
 * Output: Huỷ buổi đánh.
 */
export async function cancelEvent(eventId: string): Promise<EventSummary> {
  const response = await apiClient.post(`/events/${eventId}/cancel`)
  return eventSummaryResponseSchema.parse(response.data).data
}

/**
 * Input: eventId và trạng thái.
 * Output: Bình chọn của chính mình kèm sĩ số mới.
 */
export async function voteAttendance(
  eventId: string,
  status: AttendanceStatus,
): Promise<VoteResult> {
  const response = await apiClient.put(`/events/${eventId}/attendance`, {
    status,
  })
  return voteResultResponseSchema.parse(response.data).data
}

/**
 * Input: eventId, userId và trạng thái.
 * Output: Admin điền bình chọn hộ người khác.
 */
export async function setAttendance(
  eventId: string,
  userId: string,
  status: AttendanceStatus,
): Promise<VoteResult> {
  const response = await apiClient.put(
    `/events/${eventId}/attendances/${userId}`,
    { status },
  )
  return voteResultResponseSchema.parse(response.data).data
}

/**
 * Input: eventId và danh sách `{ userId, attended }`.
 * Output: Chấm thực tế có mặt hàng loạt.
 */
export async function markAttended(
  eventId: string,
  items: { userId: string; attended: boolean }[],
): Promise<{ updated: number }> {
  const response = await apiClient.patch(`/events/${eventId}/attendances`, {
    items,
  })
  return markAttendedResponseSchema.parse(response.data).data
}

/**
 * Input: eventId.
 * Output: Chốt sổ và chia tiền cho người thực tế có mặt.
 */
export async function finalizeEvent(eventId: string): Promise<FinalizeResult> {
  const response = await apiClient.post(`/events/${eventId}/finalize`)
  return finalizeResultResponseSchema.parse(response.data).data
}

/**
 * Input: eventId.
 * Output: Mở lại buổi đã chốt — chỉ khi chưa ai thanh toán.
 */
export async function reopenEvent(
  eventId: string,
): Promise<{ eventId: string; status: EventStatus }> {
  const response = await apiClient.post(`/events/${eventId}/reopen`)
  return reopenResultResponseSchema.parse(response.data).data
}
