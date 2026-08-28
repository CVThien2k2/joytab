import { z } from "zod"
import { envelope } from "@/schema/envelope"
import { chargePaymentStatusSchema } from "@/schema/match"

/** Mirror của BE (api/src/payments/payments.constants.ts). */
export const MAX_PAYMENT_NOTE_LENGTH = 300
export const MAX_REJECT_REASON_LENGTH = 300

export const paymentStatusSchema = z.enum(["submitted", "confirmed", "rejected"])

/**
 * Một khoản phải trả của user. `rejectReason` chỉ có khi owner đã báo chưa nhận được — đó là
 * lời giải thích duy nhất cho việc khoản này quay lại danh sách.
 */
export const userChargeSchema = z.object({
  chargeId: z.string(),
  matchId: z.string(),
  courtName: z.string(),
  startAt: z.string(),
  amount: z.number(),
  paymentStatus: chargePaymentStatusSchema,
  rejectReason: z.string().nullable(),
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

export const paymentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  proofUrl: z.string(),
  note: z.string().nullable(),
  status: paymentStatusSchema,
  rejectReason: z.string().nullable(),
  submittedAt: z.string(),
  confirmedAt: z.string().nullable(),
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

/** Form từ chối: lý do BẮT BUỘC — user không tự rút lại được nên đây là đường duy nhất báo họ. */
export const rejectPaymentFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Vui lòng nói rõ vì sao chưa nhận được")
    .max(MAX_REJECT_REASON_LENGTH, `Lý do tối đa ${MAX_REJECT_REASON_LENGTH} ký tự`),
})
