"use client"

import { useEffect, useState } from "react"

/**
 * Input: Giá trị đổi liên tục + số ms chờ.
 * Output: Giá trị đó nhưng chỉ cập nhật khi đã đứng yên đủ `delayMs`.
 *
 *         Dùng cho ô tìm kiếm: gõ "nguyễn" là 6 lần đổi state, không debounce thì 6 request
 *         bay đi và cái về sau chưa chắc là cái mới nhất.
 *
 *         Cleanup huỷ timer cũ mỗi lần giá trị đổi — thiếu dòng đó thì mọi timer đều nổ và
 *         hàm này không debounce gì cả, chỉ làm chậm mọi thứ đi `delayMs`.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
