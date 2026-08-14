import { z } from "zod"
import {
  attendanceStatusSchema,
  eventStatusSchema,
} from "@/schema/enums"
import {
  attendanceSchema,
  eventDetailSchema,
  eventFormSchema,
  eventSummarySchema,
  eventTemplateSchema,
  extraCostSchema,
  finalizeFormSchema,
  finalizeResultSchema,
  templateFormSchema,
  voteResultSchema,
} from "@/schema/event"

export type ExtraCost = z.infer<typeof extraCostSchema>
export type EventTemplate = z.infer<typeof eventTemplateSchema>
export type EventSummary = z.infer<typeof eventSummarySchema>
export type EventDetail = z.infer<typeof eventDetailSchema>
export type Attendance = z.infer<typeof attendanceSchema>
export type VoteResult = z.infer<typeof voteResultSchema>
export type FinalizeResult = z.infer<typeof finalizeResultSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>

export type TemplateFormValues = z.infer<typeof templateFormSchema>
export type EventFormValues = z.infer<typeof eventFormSchema>
export type FinalizeFormValues = z.infer<typeof finalizeFormSchema>
