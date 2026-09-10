"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChargePaymentStatus } from "@/types/match"

/**
 * Tab đang chọn. `null` = xem tất cả.
 *
 * Dùng chính hai giá trị của BE (`paid` / `unpaid`) làm value của tab thay vì một bộ tên riêng
 * rồi map qua: bộ tên riêng chỉ thêm một chỗ để lệch nhau.
 */
export type HistoryPaymentTab = ChargePaymentStatus | null

const ALL_TAB = "all"

/**
 * Input: tab đang chọn + hàm đổi (component ĐƯỢC ĐIỀU KHIỂN, không giữ state riêng).
 * Output: Ba tab lọc theo tiền của trang Lịch sử.
 *
 *         Tất cả · Chưa thanh toán · Đã thanh toán. Đúng một trục lọc, và là trục duy nhất
 *         người ta mở trang này để hỏi ("mình còn nợ buổi nào"). Trước đây chỗ này có thêm
 *         khoảng ngày và trạng thái trận — nhưng lịch sử là sổ nợ chứ không phải bộ tra cứu,
 *         mà ba bộ lọc cho một danh sách vài chục dòng thì phần lớn thời gian chỉ để trống.
 *
 *         "Tất cả" là một tab THẬT chứ không phải trạng thái không-chọn-gì: buổi chưa chốt
 *         tiền và buổi đã huỷ không có khoản nào nên không thuộc cả hai tab kia — bỏ tab này
 *         là chúng không còn chỗ nào để hiện.
 */
export function HistoryPaymentTabs({
  value,
  onChange,
}: {
  value: HistoryPaymentTab
  onChange: (value: HistoryPaymentTab) => void
}) {
  return (
    <Tabs
      value={value ?? ALL_TAB}
      onValueChange={(next) => onChange(next === ALL_TAB ? null : (next as ChargePaymentStatus))}
    >
      <TabsList aria-label="Lọc lịch sử theo thanh toán">
        <TabsTrigger value={ALL_TAB}>Tất cả</TabsTrigger>
        {/* "Chưa thanh toán" đứng trước "Đã thanh toán": nó là việc còn phải làm, còn tab kia
            chỉ để tra lại. */}
        <TabsTrigger value="unpaid">Chưa thanh toán</TabsTrigger>
        <TabsTrigger value="paid">Đã thanh toán</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
