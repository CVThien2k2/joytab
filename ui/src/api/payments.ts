import { apiClient } from "@/api/client"
import {
  chargeGroupListResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
} from "@/schema/payment"
import type { OrganizationChargeGroup, Payment } from "@/types/payment"

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
 * Input: id tổ chức.
 * Output: Sổ chứng từ. Owner nhận của cả tổ chức, member chỉ nhận của mình — BE ép, không phụ
 *         thuộc tham số nào từ client.
 */
export async function fetchPayments(organizationId: string): Promise<Payment[]> {
  const response = await apiClient.get(`/organizations/${organizationId}/payments`)
  return paymentListResponseSchema.parse(response.data).data.payments
}

/**
 * Input: id tổ chức + các khoản được chọn + ảnh chuyển khoản.
 * Output: Lần thanh toán vừa gửi.
 *
 *         Gửi danh sách KHOẢN chứ không gửi số tiền — số tiền do BE cộng từ chính các khoản đó.
 *         Gửi xong là các khoản đó ĐÃ TRẢ luôn, không ai duyệt và không có đường tự huỷ.
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
