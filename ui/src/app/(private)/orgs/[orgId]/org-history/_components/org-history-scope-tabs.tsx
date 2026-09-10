"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { OrganizationHistoryScope } from "@/types/match"

/**
 * Input: lát cắt đang chọn + hàm đổi (component ĐƯỢC ĐIỀU KHIỂN, không giữ state riêng).
 * Output: Ba tab của sổ lịch sử tổ chức.
 *
 *         Dùng thẳng ba giá trị của BE làm value của tab thay vì một bộ tên riêng rồi map qua:
 *         bộ tên riêng chỉ thêm một chỗ để lệch nhau.
 *
 *         "Tất cả" đứng trước hai tab việc-còn-treo, nhưng hai tab kia mới là lý do trang này
 *         tồn tại: chúng là danh sách VIỆC PHẢI LÀM của chủ tổ chức, còn "Tất cả" chỉ để tra
 *         lại một buổi cũ.
 *
 *         Không có tab "đã xong": một buổi đã chốt giá và thu đủ tiền thì không còn việc gì —
 *         nó nằm trong "Tất cả" là đủ, một tab riêng cho nó sẽ luôn là tab dài nhất và không
 *         ai mở.
 */
export function OrgHistoryScopeTabs({
  value,
  onChange,
}: {
  value: OrganizationHistoryScope
  onChange: (value: OrganizationHistoryScope) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as OrganizationHistoryScope)}>
      <TabsList aria-label="Lọc lịch sử tổ chức">
        <TabsTrigger value="all">Tất cả</TabsTrigger>
        <TabsTrigger value="uncollected">Chưa thu hết tiền</TabsTrigger>
        <TabsTrigger value="unsettled">Chưa chốt giá</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
