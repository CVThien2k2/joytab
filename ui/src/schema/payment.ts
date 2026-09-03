import { z } from "zod"
import { envelope } from "@/schema/envelope"
import { chargePaymentStatusSchema } from "@/schema/match"

/** Mirror của BE (api/src/payments/payments.constants.ts). */
export const MAX_PAYMENT_NOTE_LENGTH = 300

/** Một khoản phải trả của user, kèm ngữ cảnh trận để hiển thị. */
export const userChargeSchema = z.object({
  chargeId: z.string(),
  matchId: z.string(),
  courtName: z.string(),
  startAt: z.string(),
  amount: z.number(),
  paymentStatus: chargePaymentStatusSchema,
})

/**
 * Công nợ trong MỘT tổ chức — đơn vị mà một lần chuyển khoản trả được, vì QR là của tổ chức.
 */
export const organizationChargeGroupSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  paymentQrUrl: z.string().nullable(),
  unpaidTotal: z.number(),
  charges: z.array(userChargeSchema),
})

/**
 * Một lần chuyển khoản đã ghi nhận. Không có trạng thái: không ai duyệt, nên một row tồn tại
 * đã nghĩa là "đã chuyển".
 */
export const paymentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  proofUrl: z.string(),
  note: z.string().nullable(),
  submittedAt: z.string(),
  total: z.number(),
  items: z.array(
    z.object({
      matchId: z.string(),
      courtName: z.string(),
      startAt: z.string(),
      amount: z.number(),
    }),
  ),
})

export const chargeGroupListResponseSchema = envelope(
  z.object({ groups: z.array(organizationChargeGroupSchema) }),
)
export const paymentListResponseSchema = envelope(z.object({ payments: z.array(paymentSchema) }))
export const paymentResponseSchema = envelope(z.object({ payment: paymentSchema }))
