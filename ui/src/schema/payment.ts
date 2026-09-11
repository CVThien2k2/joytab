import { z } from "zod"
import { envelope } from "@/schema/envelope"
import { chargePaymentStatusSchema } from "@/schema/match"
import { bankAccountSchema } from "@/schema/organization"

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
 * Công nợ trong MỘT tổ chức — đơn vị mà một lần chuyển khoản trả được, vì tài khoản nhận tiền
 * là của tổ chức.
 */
export const organizationChargeGroupSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  /** null = tổ chức chưa cấu hình tài khoản nhận tiền; FE phải chặn nút thanh toán. */
  bankAccount: bankAccountSchema.nullable(),
  /**
   * Chuỗi để vẽ thành mã QR, BE đã nhét sẵn ĐÚNG `unpaidTotal` và tên người trả.
   * null cùng lúc với `bankAccount`.
   */
  vietQrPayload: z.string().nullable(),
  unpaidTotal: z.number(),
  charges: z.array(userChargeSchema),
})

/**
 * Một lần chuyển khoản đã ghi nhận. Không có trạng thái: không ai duyệt, nên một row tồn tại
 * đã nghĩa là "đã chuyển".
 *
 * Chỉ còn là kiểu TRẢ VỀ của POST /payments — không màn nào liệt kê sổ chứng từ nữa (mỗi buổi
 * đã tự mang nhãn đã trả / chưa trả ở trang Lịch sử).
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
export const paymentResponseSchema = envelope(z.object({ payment: paymentSchema }))
