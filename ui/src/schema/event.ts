import { z } from "zod"
import { envelope } from "@/schema/envelope"
import {
  attendanceStatusSchema,
  eventStatusSchema,
  memberRoleSchema,
} from "@/schema/enums"
import { intField } from "@/schema/money-field"

export const extraCostSchema = z.object({
  name: z.string(),
  amount: z.number(),
})

export const eventTemplateSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  dayOfWeek: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  locationName: z.string().nullable(),
  locationAddress: z.string().nullable(),
  courtCost: z.number(),
  maxParticipants: z.number(),
  voteLockMinutesBefore: z.number(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
})

export const eventSummarySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  title: z.string(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  locationName: z.string().nullable(),
  locationAddress: z.string().nullable(),
  courtCost: z.number(),
  extraCosts: z.array(extraCostSchema),
  totalCost: z.number(),
  maxParticipants: z.number(),
  voteLockedAt: z.coerce.date(),
  status: eventStatusSchema,
  goingCount: z.number(),
  isFull: z.boolean(),
  isLocked: z.boolean(),
  completedAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
})

export const attendanceSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  status: attendanceStatusSchema,
  attended: z.boolean().nullable(),
  votedAt: z.coerce.date(),
})

export const eventDetailSchema = eventSummarySchema.extend({
  attendances: z.array(attendanceSchema),
  myAttendance: z
    .object({ status: attendanceStatusSchema, attended: z.boolean().nullable() })
    .nullable(),
  myRole: memberRoleSchema,
})

export const voteResultSchema = z.object({
  eventId: z.string(),
  userId: z.string(),
  status: attendanceStatusSchema,
  attended: z.boolean().nullable(),
  goingCount: z.number(),
  isFull: z.boolean(),
})

export const finalizeResultSchema = z.object({
  eventId: z.string(),
  totalAmount: z.number(),
  settlements: z.array(z.object({ userId: z.string(), amount: z.number() })),
})

export const eventTemplateResponseSchema = envelope(eventTemplateSchema)
export const eventTemplateListResponseSchema = envelope(z.array(eventTemplateSchema))
export const eventSummaryResponseSchema = envelope(eventSummarySchema)
export const eventDetailResponseSchema = envelope(eventDetailSchema)
export const eventListResponseSchema = envelope(
  z.object({
    items: z.array(eventSummarySchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
)
export const voteResultResponseSchema = envelope(voteResultSchema)
export const finalizeResultResponseSchema = envelope(finalizeResultSchema)
export const generateResultResponseSchema = envelope(
  z.object({ templateId: z.string(), created: z.number() }),
)
export const markAttendedResponseSchema = envelope(z.object({ updated: z.number() }))
export const reopenResultResponseSchema = envelope(
  z.object({ eventId: z.string(), status: eventStatusSchema }),
)
export const deleteTemplateResponseSchema = envelope(z.object({ id: z.string() }))

// ===== Form input =====

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const templateFormSchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên lịch"),
    dayOfWeek: z.string(),
    startTime: z.string().regex(timePattern, "Giờ dạng HH:mm"),
    endTime: z.string().regex(timePattern, "Giờ dạng HH:mm"),
    locationName: z.string(),
    courtCost: intField("Nhập tiền sân").min(0, "Tiền sân không âm"),
    maxParticipants: intField("Nhập sĩ số").min(1, "Ít nhất 1 người"),
    voteLockMinutesBefore: intField("Nhập số phút").min(0, "Không âm"),
    active: z.boolean(),
  })
  .refine((value) => value.startTime !== value.endTime, {
    message: "Giờ kết thúc phải khác giờ bắt đầu",
    path: ["endTime"],
  })

export const eventFormSchema = z.object({
  title: z.string().trim().min(1, "Nhập tên buổi đánh"),
  /** `datetime-local` trả `YYYY-MM-DDTHH:mm`, hiểu theo giờ VN. */
  startAt: z.string().min(1, "Chọn giờ bắt đầu"),
  endAt: z.string().min(1, "Chọn giờ kết thúc"),
  locationName: z.string(),
  courtCost: intField("Nhập tiền sân").min(0, "Tiền sân không âm"),
  maxParticipants: intField("Nhập sĩ số").min(1, "Ít nhất 1 người"),
  voteLockMinutesBefore: intField("Nhập số phút").min(0, "Không âm"),
})

export const finalizeFormSchema = z.object({
  courtCost: intField("Nhập tiền sân").min(0, "Tiền sân không âm"),
  extraCosts: z.array(
    z.object({
      name: z.string().trim().min(1, "Nhập tên khoản"),
      amount: intField("Nhập số tiền").min(0, "Không âm"),
    }),
  ),
})
