import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Input: Callback React gọi khi cần được báo có thay đổi.
 * Output: Hàm huỷ đăng ký.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MEDIA_QUERY)
  mediaQuery.addEventListener("change", onStoreChange)
  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

/**
 * Input: Không nhận tham số.
 * Output: true nếu viewport đang ở khổ mobile.
 *
 * Dùng `useSyncExternalStore` thay vì useState + useEffect: matchMedia là external store
 * đúng nghĩa, và cách này không setState trong effect (gây cascading render) cũng không
 * lệch giá trị ở lần render đầu. Server luôn trả false vì không có window để đo.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
