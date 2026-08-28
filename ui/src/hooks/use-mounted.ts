"use client"

import { useSyncExternalStore } from "react"

/** Không bao giờ có thay đổi để đăng ký — giá trị chỉ khác nhau giữa server và client. */
const subscribe = () => () => {}

/**
 * Input: Không nhận tham số.
 * Output: `false` khi render trên server và ở lượt hydrate, `true` từ lượt render sau.
 *
 *         Dùng cho UI phụ thuộc thứ chỉ client biết (vd theme đang chọn của next-themes): render
 *         thẳng giá trị đó sẽ khác giữa HTML server sinh ra và lần render đầu ở client → React
 *         báo lệch hydrate.
 *
 *         Làm bằng `useSyncExternalStore` chứ không `useState` + `useEffect`: react-compiler
 *         (đang bật ở project này) cấm setState trong effect. Cách này còn đúng hơn về bản chất —
 *         React dùng `getServerSnapshot` cho lượt hydrate nên hai bên khớp nhau, rồi mới đổi.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
