"use client"

import { useState } from "react"

/**
 * Input: Không nhận tham số.
 * Output: Mốc "bây giờ" (ms), CHỐT một lần lúc component mount.
 *
 *         Gọi thẳng `Date.now()` trong thân component là đọc một giá trị đổi mỗi lần render:
 *         React Compiler chặn (react-hooks/purity), và hậu quả thật thì tệ hơn cảnh báo — một
 *         khoảng ngày tính từ `Date.now()` sẽ khác nhau ở mỗi lần render, tạo query key mới
 *         mỗi lần, và React Query fetch không bao giờ dừng.
 *
 *         Chốt lúc mount nghĩa là mở trang qua đêm thì mốc này cũ đi. Chấp nhận được: nó chỉ
 *         dùng để xếp "sắp tới / đã qua" và để hiện nút, còn luật thật (đóng vote, chặn huỷ,
 *         chốt chi phí) do BE quyết ở từng request.
 */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}
