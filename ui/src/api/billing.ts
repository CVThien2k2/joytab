import { apiClient } from "@/api/client"
import {
  memberDebtListResponseSchema,
  myDebtsResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
} from "@/schema/billing"
import type {
  MemberDebt,
  MyDebts,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "@/types/billing"

export type CreatePaymentInput = {
  userId?: string
  amount: number
  method: PaymentMethod
  note?: string
  allocations?: { settlementId: string; amount: number }[]
}

/**
 * Input: orgId.
 * Output: Từng khoản nợ của tôi trong nhóm + tổng.
 */
export async function fetchMyDebts(orgId: string): Promise<MyDebts> {
  const response = await apiClient.get(`/organizations/${orgId}/debts/me`)
  return myDebtsResponseSchema.parse(response.data).data
}

/**
 * Input: orgId.
 * Output: Công nợ theo từng thành viên (chỉ ADMIN gọi được).
 */
export async function fetchOrgDebts(orgId: string): Promise<MemberDebt[]> {
  const response = await apiClient.get(`/organizations/${orgId}/debts`)
  return memberDebtListResponseSchema.parse(response.data).data
}

/**
 * Input: orgId + thông tin thanh toán.
 * Output: Thanh toán vừa tạo. MEMBER → chờ duyệt; ADMIN → xác nhận ngay.
 *
 * Bỏ trống `allocations` thì BE tự phân bổ nợ cũ trước.
 */
export async function createPayment(
  orgId: string,
  input: CreatePaymentInput,
): Promise<Payment> {
  const response = await apiClient.post(
    `/organizations/${orgId}/payments`,
    input,
  )
  return paymentResponseSchema.parse(response.data).data
}

/**
 * Input: orgId + bộ lọc.
 * Output: Danh sách thanh toán. MEMBER chỉ thấy của mình.
 */
export async function fetchPayments(
  orgId: string,
  filters: { status?: PaymentStatus; userId?: string },
): Promise<Payment[]> {
  const response = await apiClient.get(`/organizations/${orgId}/payments`, {
    params: filters,
  })
  return paymentListResponseSchema.parse(response.data).data
}

/**
 * Input: paymentId.
 * Output: Duyệt thanh toán — BE validate lại phân bổ rồi cộng vào công nợ.
 */
export async function confirmPayment(paymentId: string): Promise<Payment> {
  const response = await apiClient.post(`/payments/${paymentId}/confirm`)
  return paymentResponseSchema.parse(response.data).data
}

/**
 * Input: paymentId.
 * Output: Từ chối thanh toán — không đụng vào công nợ.
 */
export async function rejectPayment(paymentId: string): Promise<Payment> {
  const response = await apiClient.post(`/payments/${paymentId}/reject`)
  return paymentResponseSchema.parse(response.data).data
}
