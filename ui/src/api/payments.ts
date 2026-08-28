import { apiClient } from "@/api/client"
import {
  chargeGroupListResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
} from "@/schema/payment"
import type { OrganizationChargeGroup, Payment, PaymentStatus } from "@/types/payment"

/**
 * Input: id tổ chức.
 * Output: Công nợ của chính người gọi trong tổ chức đó.
 *
 *         Trả về dạng NHÓM (một phần tử) chứ không phải mảng khoản phẳng: nhóm mang theo mã QR
 *         và tổng nợ của tổ chức — đúng những thứ hộp thoại thanh toán cần.
 */
export async function fetchOrganizationCharges(
  organizationId: string,
): Promise<OrganizationChargeGroup[]> {
  const response = await apiClient.get(`/organizations/${organizationId}/charges/me`)
  return chargeGroupListResponseSchema.parse(response.data).data.groups
}

/**
 * Input: id tổ chức + bộ lọc trạng thái.
 * Output: Owner nhận của cả tổ chức, member chỉ nhận của mình — BE ép, không phụ thuộc tham số.
 */
export async function fetchPayments(params: {
  organizationId: string
  status?: PaymentStatus
}): Promise<Payment[]> {
  const response = await apiClient.get(`/organizations/${params.organizationId}/payments`, {
    params: params.status ? { status: params.status } : undefined,
  })
  return paymentListResponseSchema.parse(response.data).data.payments
}

/**
 * Input: id tổ chức + các khoản được chọn + ảnh chuyển khoản.
 * Output: Lần thanh toán vừa gửi.
 *
 *         Gửi danh sách KHOẢN chứ không gửi số tiền — số tiền do BE cộng từ chính các khoản đó.
 *         Đây là thao tác duy nhất của user trong luồng tiền: không có đường tự huỷ.
 */
export async function createPayment(params: {
  organizationId: string
  chargeIds: string[]
  proofUrl: string
  note?: string
}): Promise<Payment> {
  const response = await apiClient.post(`/organizations/${params.organizationId}/payments`, {
    chargeIds: params.chargeIds,
    proofUrl: params.proofUrl,
    ...(params.note ? { note: params.note } : {}),
  })
  return paymentResponseSchema.parse(response.data).data.payment
}

export async function confirmPayment(params: {
  organizationId: string
  paymentId: string
}): Promise<Payment> {
  const response = await apiClient.post(
    `/organizations/${params.organizationId}/payments/${params.paymentId}/confirm`,
  )
  return paymentResponseSchema.parse(response.data).data.payment
}

/** Từ chối: các khoản quay lại danh sách phải trả của user, kèm đúng lý do này. */
export async function rejectPayment(params: {
  organizationId: string
  paymentId: string
  reason: string
}): Promise<Payment> {
  const response = await apiClient.post(
    `/organizations/${params.organizationId}/payments/${params.paymentId}/reject`,
    { reason: params.reason },
  )
  return paymentResponseSchema.parse(response.data).data.payment
}

/** Bỏ duyệt — dùng khi owner bấm nhầm. Đưa về hàng đợi chứ không đẩy ngược thành nợ. */
export async function unconfirmPayment(params: {
  organizationId: string
  paymentId: string
}): Promise<Payment> {
  const response = await apiClient.delete(
    `/organizations/${params.organizationId}/payments/${params.paymentId}/confirm`,
  )
  return paymentResponseSchema.parse(response.data).data.payment
}
