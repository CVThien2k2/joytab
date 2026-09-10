"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { createPayment, fetchOrganizationCharges } from "@/api/payments"
import { matchQueryKeys } from "@/hooks/use-matches-api"

export const paymentQueryKeys = {
  charges: () => ["charges"] as const,
  organizationCharges: (organizationId: string) =>
    [...paymentQueryKeys.charges(), "organization", organizationId] as const,
}

/**
 * Làm mới mọi thứ một thay đổi về tiền có thể đụng tới: công nợ, bảng chia tiền của trận
 * (trạng thái từng khoản nằm trong đó), và bốn con số ở trang chủ.
 */
function invalidatePaymentData(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: paymentQueryKeys.charges() })
  void queryClient.invalidateQueries({ queryKey: matchQueryKeys.organization(organizationId) })
  void queryClient.invalidateQueries({ queryKey: ["matches", "settlement"] })
  // Hai thẻ tiền ở trang chủ (cần trả / đã trả) đọc từ chính các khoản vừa chuyển trạng thái.
  void queryClient.invalidateQueries({ queryKey: ["organizations", "overview"] })
}

/**
 * Công nợ của mình trong một tổ chức — nguồn của tab "Khoản của tôi", của badge trên sidebar
 * và của banner nhắc nợ.
 *
 * `enabled` theo id vì sidebar gọi hook này ở MỌI trang, kể cả lúc chưa có tổ chức nào đang
 * chọn — hook không được gọi có điều kiện, nên chỗ chặn phải nằm ở đây.
 */
export function useOrganizationCharges(organizationId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.organizationCharges(organizationId),
    queryFn: () => fetchOrganizationCharges(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
  })
}

/**
 * Input: id tổ chức.
 * Output: Tóm tắt nợ: nhóm công nợ, số khoản chưa trả, tổng tiền chưa trả.
 *
 *         Badge sidebar và banner nhắc nợ đều đi qua đây nên chúng dùng CHUNG một entry cache
 *         của react-query — hai chỗ hiển thị, một request, và không bao giờ lệch nhau một con
 *         số. Chúng cũng tự mới lại sau khi thanh toán, vì `invalidatePaymentData` đã xoá cả
 *         nhánh `charges`.
 *
 *         Vẫn tự đếm khoản `unpaid` thay vì tin `charges.length`: BE hiện chỉ trả khoản chưa
 *         trả, nhưng một badge đếm nhầm cả khoản đã trả là thứ không ai giải thích được.
 */
export function useUnpaidChargeSummary(organizationId: string) {
  const { data } = useOrganizationCharges(organizationId)
  // Một tổ chức = một nhóm; mảng rỗng nghĩa là không nợ gì.
  const group = data?.[0] ?? null
  const unpaidCount =
    group?.charges.filter((charge) => charge.paymentStatus === "unpaid").length ?? 0

  return {
    group,
    unpaidCount,
    unpaidTotal: unpaidCount > 0 ? (group?.unpaidTotal ?? 0) : 0,
  }
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
