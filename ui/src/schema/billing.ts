import { z } from "zod"
import { envelope } from "@/schema/envelope"
import {
  debtStatusSchema,
  paymentMethodSchema,
  paymentStatusSchema,
} from "@/schema/enums"
import { intField } from "@/schema/money-field"

export const debtLineSchema = z.object({
  settlementId: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  eventStartAt: z.coerce.date(),
  amount: z.number(),
  paidAmount: z.number(),
  remaining: z.number(),
  status: debtStatusSchema,
})

export const myDebtsSchema = z.object({
  items: z.array(debtLineSchema),
  totalAmount: z.number(),
  totalPaid: z.number(),
  remaining: z.number(),
})

export const memberDebtSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  totalAmount: z.number(),
  totalPaid: z.number(),
  remaining: z.number(),
})

export const paymentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  userFullName: z.string().nullable(),
  userEmail: z.string(),
  amount: z.number(),
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  note: z.string().nullable(),
  allocations: z.array(
    z.object({
      settlementId: z.string(),
      eventId: z.string(),
      eventTitle: z.string(),
      amount: z.number(),
    }),
  ),
  createdBy: z.string(),
  confirmedBy: z.string().nullable(),
  confirmedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export const myDebtsResponseSchema = envelope(myDebtsSchema)
export const memberDebtListResponseSchema = envelope(z.array(memberDebtSchema))
export const paymentResponseSchema = envelope(paymentSchema)
export const paymentListResponseSchema = envelope(z.array(paymentSchema))

// ===== Form input =====

export const paymentFormSchema = z.object({
  amount: intField("Nhập số tiền").min(1, "Số tiền phải lớn hơn 0"),
  method: paymentMethodSchema,
  note: z.string(),
  /** Chuỗi rỗng = ADMIN trả cho chính mình. */
  userId: z.string(),
})
