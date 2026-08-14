"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  cancelEvent,
  createEvent,
  createTemplate,
  deleteTemplate,
  fetchEvent,
  fetchEvents,
  fetchTemplates,
  finalizeEvent,
  generateFromTemplate,
  markAttended,
  reopenEvent,
  setAttendance,
  updateEvent,
  updateTemplate,
  type EventInput,
  type EventListFilters,
  type TemplateInput,
} from "@/api/events"
import { voteAttendance } from "@/api/events"
import { queryKeys } from "@/hooks/query-keys"
import { getErrorMessage } from "@/lib/error-code"
import type { AttendanceStatus, EventDetail } from "@/types/event"

/** Thông báo riêng cho luồng vote — hai mã này người dùng gặp thường xuyên nhất. */
const VOTE_ERROR_OVERRIDES = {
  EVT_002: "Buổi đánh đã đủ người",
  EVT_003: "Đã khoá bình chọn",
}

// ===== Lịch định kỳ =====

export function useTemplates(orgId: string) {
  return useQuery({
    queryKey: queryKeys.templates(orgId),
    queryFn: () => fetchTemplates(orgId),
    enabled: Boolean(orgId),
  })
}

export function useCreateTemplate(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: TemplateInput) => createTemplate(orgId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates(orgId) })
      toast.success("Đã tạo lịch định kỳ")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateTemplate(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string
      input: Partial<TemplateInput>
    }) => updateTemplate(orgId, templateId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates(orgId) })
      toast.success("Đã cập nhật lịch")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteTemplate(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(orgId, templateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates(orgId) })
      toast.success("Đã xoá lịch định kỳ")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: orgId.
 * Output: Sinh bù buổi đánh ngay thay vì chờ cron 01:00. Idempotent nên bấm mấy lần cũng được.
 */
export function useGenerateFromTemplate(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => generateFromTemplate(orgId, templateId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["events", orgId] })
      toast.success(
        result.created > 0
          ? `Đã tạo ${result.created} buổi đánh`
          : "Các buổi trong 14 ngày tới đã có đủ",
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

// ===== Buổi đánh =====

export function useEvents(orgId: string, filters: EventListFilters) {
  return useQuery({
    queryKey: queryKeys.events(orgId, filters),
    queryFn: () => fetchEvents(orgId, filters),
    enabled: Boolean(orgId),
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => fetchEvent(eventId),
    enabled: Boolean(eventId),
  })
}

export function useCreateEvent(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: EventInput) => createEvent(orgId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", orgId] })
      toast.success("Đã tạo buổi đánh")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateEvent(eventId: string, orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<EventInput>) => updateEvent(eventId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["events", orgId] }),
      ])
      toast.success("Đã cập nhật buổi đánh")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCancelEvent(eventId: string, orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => cancelEvent(eventId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["events", orgId] }),
      ])
      toast.success("Đã huỷ buổi đánh")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: eventId và userId của chính mình.
 * Output: Bình chọn với optimistic update — đây là nút được bấm nhiều nhất cả app nên phải
 *         phản hồi tức thì, không chờ round-trip.
 *
 * Rollback về snapshot cũ khi lỗi (thường là EVT_002 do người khác vừa giành mất slot cuối),
 * rồi invalidate để lấy sĩ số thật.
 */
export function useVote(eventId: string, myUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: AttendanceStatus) => voteAttendance(eventId, status),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.event(eventId) })
      const previous = queryClient.getQueryData<EventDetail>(queryKeys.event(eventId))
      if (!previous) return { previous }

      const wasGoing = previous.myAttendance?.status === "GOING"
      const goingDelta = status === "GOING" ? (wasGoing ? 0 : 1) : wasGoing ? -1 : 0
      const goingCount = previous.goingCount + goingDelta

      queryClient.setQueryData<EventDetail>(queryKeys.event(eventId), {
        ...previous,
        goingCount,
        isFull: goingCount >= previous.maxParticipants,
        myAttendance: { status, attended: previous.myAttendance?.attended ?? null },
        attendances: previous.attendances.some((item) => item.userId === myUserId)
          ? previous.attendances.map((item) =>
              item.userId === myUserId ? { ...item, status } : item,
            )
          : previous.attendances,
      })

      return { previous }
    },
    onError: (error, _status, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.event(eventId), context.previous)
      }
      toast.error(getErrorMessage(error, VOTE_ERROR_OVERRIDES))
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) })
    },
  })
}

/**
 * Input: eventId.
 * Output: Admin điền bình chọn hộ người khác — bỏ qua mốc khoá, vẫn tôn trọng sĩ số.
 */
export function useSetAttendance(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string
      status: AttendanceStatus
    }) => setAttendance(eventId, userId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) })
    },
    onError: (error) => toast.error(getErrorMessage(error, VOTE_ERROR_OVERRIDES)),
  })
}

export function useMarkAttended(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: { userId: string; attended: boolean }[]) =>
      markAttended(eventId, items),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) })
      toast.success("Đã lưu điểm danh")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Input: eventId và orgId.
 * Output: Chốt sổ, chia tiền. Công nợ đổi theo nên phải invalidate cả hai màn nợ.
 */
export function useFinalizeEvent(eventId: string, orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => finalizeEvent(eventId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["events", orgId] }),
        queryClient.invalidateQueries({ queryKey: ["debts", orgId] }),
      ])
      toast.success("Đã chốt sổ và chia tiền")
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, {
          EVT_005: "Chưa chấm ai thực tế có mặt — chấm điểm danh trước đã",
        }),
      ),
  })
}

export function useReopenEvent(eventId: string, orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => reopenEvent(eventId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) }),
        queryClient.invalidateQueries({ queryKey: ["events", orgId] }),
        queryClient.invalidateQueries({ queryKey: ["debts", orgId] }),
      ])
      toast.success("Đã mở lại buổi đánh")
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, {
          EVT_006: "Đã có người thanh toán nên không mở lại được",
        }),
      ),
  })
}
