"use client";

import { useEffect, useState } from "react";

/**
 * Input: Giá trị thay đổi liên tục và độ trễ (ms).
 * Output: Giá trị chỉ cập nhật sau khi đã "yên" đủ `delayMs`.
 *
 * Dùng để chặn việc gọi API theo từng ký tự người dùng gõ.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
