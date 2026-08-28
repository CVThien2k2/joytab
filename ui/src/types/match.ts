import { z } from "zod"
import {
  expenseLineFormSchema,
  matchChargeSchema,
  matchDetailSchema,
  matchExpenseSchema,
  matchFormSchema,
  matchParticipantSchema,
  matchSettlementSchema,
  matchSummarySchema,
  matchVoteEventSchema,
  settlementFormSchema,
} from "@/schema/match"

export type MatchSummary = z.infer<typeof matchSummarySchema>
export type MatchDetail = z.infer<typeof matchDetailSchema>
export type MatchParticipant = z.infer<typeof matchParticipantSchema>
export type MatchVoteEvent = z.infer<typeof matchVoteEventSchema>
export type MatchExpense = z.infer<typeof matchExpenseSchema>
export type MatchCharge = z.infer<typeof matchChargeSchema>
export type MatchSettlement = z.infer<typeof matchSettlementSchema>
export type MatchStatus = MatchSummary["status"]
export type VoteClosedReason = MatchSummary["voteClosedReason"]

/**
 * Form nhập số dạng chuỗi rồi mới ép kiểu, nên input khác output — react-hook-form phải dùng
 * `z.input`, còn payload gửi đi dùng `z.infer`.
 */
export type MatchFormValues = z.input<typeof matchFormSchema>
export type MatchFormPayload = z.infer<typeof matchFormSchema>
export type ExpenseLineValues = z.input<typeof expenseLineFormSchema>
export type SettlementFormValues = z.input<typeof settlementFormSchema>
export type SettlementFormPayload = z.infer<typeof settlementFormSchema>
