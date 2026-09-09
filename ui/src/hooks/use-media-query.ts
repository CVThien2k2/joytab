"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Ngưỡng "mobile" — khớp breakpoint `md` của Tailwind (768px), nên nhánh JS và các class
 * `sm:`/`md:` luôn đổi cùng một lúc. Hai ngưỡng lệch nhau vài pixel là chỗ sinh ra những bố cục
 * chỉ sai ở đúng một bề rộng máy.
 */
export const MOBILE_MEDIA_QUERY = "(max-width: 767.98px)"

/**
 * Input: một media query.
 * Output: Query đó có đang khớp không, tự cập nhật khi đổi bề rộng / quay máy.
 *
 *         `useSyncExternalStore` chứ không `useState` + `useEffect`: nó có sẵn một ảnh riêng
 *         cho server (`() => false`), nên không có nhịp render nào đọc `window` khi chưa có
 *         `window`, và cũng không cần một cờ `mounted` rắc khắp nơi.
 *
 *         Ảnh server là `false` — tức "coi như desktop". Chọn phía nào cũng phải chọn một,
 *         mà đoán sai ở desktop chỉ là bố cục rộng hơn cần thiết trong một nhịp, còn đoán sai
 *         ở mobile là lưới 7 cột đổ vào màn 360px.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onStoreChange)
      return () => list.removeEventListener("change", onStoreChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Đang ở màn hẹp hơn breakpoint `md`. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY)
}
