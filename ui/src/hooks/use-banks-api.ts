"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchBanks } from "@/api/banks"

/** Khoá cache của danh sách ngân hàng. Một danh sách duy nhất, không tham số. */
export const bankQueryKeys = {
  list: ["banks", "list"] as const,
}

/**
 * Input: `enabled` — chỉ tải khi ô chọn ngân hàng thật sự hiện ra.
 * Output: Query GET /banks.
 *
 *         `enabled` mặc định false: danh sách này chỉ cần ở hai hộp thoại (tạo và sửa tổ chức),
 *         mà phần lớn phiên dùng app không mở hộp thoại nào trong hai cái đó. Tải sẵn là bắt mọi
 *         người trả tiền mạng cho một việc hiếm.
 *
 *         `staleTime` một ngày, bằng cache của BE: danh sách ngân hàng cả năm mới đổi một dòng,
 *         mà mở đi mở lại hộp thoại trong cùng một phiên là chuyện thường.
 */
export function useBanks(enabled = false) {
  return useQuery({
    queryKey: bankQueryKeys.list,
    queryFn: fetchBanks,
    enabled,
    retry: false,
    staleTime: 24 * 60 * 60_000,
  })
}
