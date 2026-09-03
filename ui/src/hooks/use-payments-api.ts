"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { createPayment, fetchOrganizationCharges, fetchPayments } from "@/api/payments"
import { matchQueryKeys } from "@/hooks/use-matches-api"

export const paymentQueryKeys = {
  charges: () => ["charges"] as const,
  organizationCharges: (organizationId: string) =>
    [...paymentQueryKeys.charges(), "organization", organizationId] as const,
  payments: (organizationId: string) => ["payments", organizationId] as const,
}

/**
 * Làm mới mọi thứ một thay đổi về tiền có thể đụng tới: công nợ, sổ chứng từ, và bảng chia tiền
 * của trận (trạng thái từng khoản nằm trong đó).
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
 * Input: id tổ chức.
 * Output: Query sổ chứng từ. Owner nhận của cả tổ chức, member chỉ của mình — BE quyết, hook
 *         không cần biết vai trò.
 */
export function usePayments(organizationId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.payments(organizationId),
    queryFn: () => fetchPayments(organizationId),
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
      toast.success("Đã ghi nhận thanh toán")
      onSuccess?.()
      invalidatePaymentData(queryClient, organizationId)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không gửi được thanh toán. Vui lòng thử lại."))
    },
  })
}
