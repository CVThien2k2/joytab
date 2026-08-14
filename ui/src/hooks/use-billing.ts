"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  confirmPayment,
  createPayment,
  fetchMyDebts,
  fetchOrgDebts,
  fetchPayments,
  rejectPayment,
  type CreatePaymentInput,
} from "@/api/billing"
import { queryKeys } from "@/hooks/query-keys"
import { getErrorMessage } from "@/lib/error-code"
import type { PaymentStatus } from "@/types/billing"

/** Duyệt/từ chối/tạo thanh toán đều làm công nợ đổi theo, nên luôn refresh cùng một cụm key. */
function billingQueryKeys(orgId: string) {
  return [["debts", orgId], ["payments", orgId]]
}

export function useMyDebts(orgId: string) {
  return useQuery({
    queryKey: queryKeys.myDebts(orgId),
    queryFn: () => fetchMyDebts(orgId),
    enabled: Boolean(orgId),
  })
}

export function useOrgDebts(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.orgDebts(orgId),
    queryFn: () => fetchOrgDebts(orgId),
    enabled: Boolean(orgId) && enabled,
  })
}

export function usePayments(orgId: string, filters: { status?: PaymentStatus }) {
  return useQuery({
    queryKey: queryKeys.payments(orgId, filters),
    queryFn: () => fetchPayments(orgId, filters),
    enabled: Boolean(orgId),
  })
}

/**
 * Input: orgId.
 * Output: Tạo thanh toán. MEMBER tạo ra bản chờ duyệt; ADMIN tạo là xác nhận luôn.
 */
export function useCreatePayment(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePaymentInput) => createPayment(orgId, input),
    onSuccess: async (payment) => {
      await Promise.all(
        billingQueryKeys(orgId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
      toast.success(
        payment.status === "CONFIRMED"
          ? "Đã ghi nhận thanh toán"
          : "Đã gửi báo trả, chờ quản trị viên duyệt",
      )
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, {
          PAY_003: "Số tiền vượt quá tổng nợ hiện tại",
          PAY_004: "Số tiền vượt quá khoản còn nợ",
        }),
      ),
  })
}

export function useConfirmPayment(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paymentId: string) => confirmPayment(paymentId),
    onSuccess: async () => {
      await Promise.all(
        billingQueryKeys(orgId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
      toast.success("Đã duyệt thanh toán")
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, {
          PAY_004: "Khoản nợ đã được trả bởi thanh toán khác",
        }),
      ),
  })
}

export function useRejectPayment(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paymentId: string) => rejectPayment(paymentId),
    onSuccess: async () => {
      await Promise.all(
        billingQueryKeys(orgId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      )
      toast.success("Đã từ chối thanh toán")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
