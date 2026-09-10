"use client"

import { useState } from "react"

/**
 * Input: giá trị đang mở (`null` = đang đóng).
 * Output: chính giá trị đó, hoặc giá trị KHÁC NULL gần nhất khi nó vừa bị đưa về null.
 *
 *         Sinh ra cho đúng một việc: hộp thoại lấy DỮ LIỆU làm luôn trạng thái mở
 *         (`open={member !== null}`). Kiểu đó gọn, nhưng lúc đóng thì dữ liệu biến mất NGAY,
 *         trong khi Radix còn giữ hộp thoại trên màn hình thêm 150ms để chạy animation ra —
 *         thành ra người dùng thấy chữ trong hộp thoại rỗng đi và cái hộp co lại ngay trước
 *         khi nó mờ đi. Đó chính là cú giật.
 *
 *         Giữ lại giá trị cũ thì ruột hộp thoại đứng yên suốt lúc mờ dần, còn lần mở sau đã
 *         có giá trị mới đè lên nên không ai thấy dữ liệu cũ.
 *
 *         Cập nhật state NGAY TRONG lúc render (không dùng effect): React cho phép, và đây
 *         đúng là trường hợp nó khuyến nghị — điều chỉnh state theo props. Làm bằng effect thì
 *         có một nhịp render trung gian với giá trị cũ, tức là thêm đúng cái nháy đang muốn bỏ.
 */
export function useLastPresent<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value)

  if (value !== null && value !== last) setLast(value)

  return value ?? last
}
