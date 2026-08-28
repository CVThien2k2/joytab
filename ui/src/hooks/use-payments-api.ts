"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import {
  confirmPayment,
  createPayment,
  fetchOrganizationCharges,
  fetchPayments,
  rejectPayment,
  unconfirmPayment,
} from "@/api/payments"
import { matchQueryKeys } from "@/hooks/use-matches-api"
import type { PaymentStatus } from "@/types/payment"

export const paymentQueryKeys = {
  charges: () => ["charges"] as const,
  organizationCharges: (organizationId: string) =>
    [...paymentQueryKeys.charges(), "organization", organizationId] as const,
  payments: (organizationId: string) => ["payments", organizationId] as const,
  paymentList: (organizationId: string, status?: PaymentStatus) =>
    [...paymentQueryKeys.payments(organizationId), status ?? "all"] as const,
}

/**
 * Làm mới mọi thứ một thay đổi về tiền có thể đụng tới: công nợ (hai góc nhìn), danh sách
 * lần thanh toán, và bảng chia tiền của trận (trạng thái từng khoản nằm trong đó).
 */
function invalidatePaymentData(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: paymentQueryKeys.charges() })
  void queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments(organizationId) })
  void queryClient.invalidateQueries({ queryKey: matchQueryKeys.organization(organizationId) })
  void queryClient.invalidateQueries({ queryKey: ["matches", "settlement"] })
}

/** Công nợ của mình trong một tổ chức — nguồn của tab "Khoản của tôi". */
export function useOrganizationCharges(organizationId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.organizationCharges(organizationId),
    queryFn: () => fetchOrganizationCharges(organizationId),
    staleTime: 15_000,
  })
}

/**
 * Input: id tổ chức + trạng thái cần lọc.
 * Output: Query danh sách lần thanh toán. Owner nhận của cả tổ chức, member chỉ của mình —
 *         BE quyết, hook không cần biết vai trò.
 */
export function usePayments(organizationId: string, status?: PaymentStatus) {
  return useQuery({
    queryKey: paymentQueryKeys.paymentList(organizationId, status),
    queryFn: () => fetchPayments({ organizationId, status }),
    staleTime: 15_000,
  })
}

/**
 * Input: id tổ chức + callback đóng dialog.
 * Output: Mutation gửi một lần chuyển khoản cho nhiều khoản.
 */
export function useCreatePayment(organizationId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { chargeIds: string[]; proofUrl: string; note?: string }) =>
      createPayment({ organizationId, ...params }),
    onSuccess: () => {
      toast.success("Đã gửi thanh toán, chờ chủ tổ chức đối soát")
      onSuccess?.()
      invalidatePaymentData(queryClient, organizationId)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không gửi được thanh toán. Vui lòng thử lại."))
    },
  })
}

export function useConfirmPayment(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paymentId: string) => confirmPayment({ organizationId, paymentId }),
    onSuccess: () => {
      toast.success("Đã xác nhận nhận được tiền")
      invalidatePaymentData(queryClient, organizationId)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không duyệt được. Vui lòng thử lại."))
    },
  })
}

/** Từ chối: các khoản quay lại danh sách phải trả của người gửi, kèm lý do. */
export function useRejectPayment(organizationId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { paymentId: string; reason: string }) =>
      rejectPayment({ organizationId, ...params }),
    onSuccess: () => {
      toast.success("Đã báo chưa nhận được tiền")
      onSuccess?.()
      invalidatePaymentData(queryClient, organizationId)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không gửi được phản hồi. Vui lòng thử lại."))
    },
  })
}

/** Bỏ duyệt — đưa về hàng đợi chờ đối soát, không đẩy ngược thành nợ của người đã trả. */
export function useUnconfirmPayment(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paymentId: string) => unconfirmPayment({ organizationId, paymentId }),
    onSuccess: () => {
      toast.success("Đã bỏ duyệt, khoản này quay lại hàng chờ")
      invalidatePaymentData(queryClient, organizationId)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không bỏ duyệt được. Vui lòng thử lại."))
    },
  })
}
