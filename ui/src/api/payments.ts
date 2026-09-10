import { apiClient } from "@/api/client"
import { chargeGroupListResponseSchema, paymentResponseSchema } from "@/schema/payment"
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
 * Input: id tổ chức + id lần chuyển khoản.
 * Output: Chứng từ của lần đó: ảnh, ghi chú, thời điểm, tổng, và các buổi nó trả cho.
 *
 *         Owner đọc được mọi lần của tổ chức, người khác chỉ đọc được lần của chính mình — BE
 *         ép, và mọi lối từ chối đều là 404 PAY_001.
 */
export async function fetchPayment(params: {
  organizationId: string
  paymentId: string
}): Promise<Payment> {
  const response = await apiClient.get(
    `/organizations/${params.organizationId}/payments/${params.paymentId}`,
  )
  return paymentResponseSchema.parse(response.data).data.payment
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
