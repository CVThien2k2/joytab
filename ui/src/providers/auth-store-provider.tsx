"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useStore } from "zustand"
import { createAuthStore, type AuthState, type AuthStore } from "@/stores/auth-store"

export type AuthStoreApi = ReturnType<typeof createAuthStore>

const AuthStoreContext = createContext<AuthStoreApi | null>(null)

/**
 * Input: `initialState` do layout (server) fetch sẵn + children.
 * Output: Tạo store một lần cho mỗi request và đưa xuống qua context.
 *
 * Dùng useState với initializer thay vì gọi createAuthStore() trực tiếp trong thân component:
 * gọi trực tiếp thì mỗi lần re-render là một store mới, mất hết state.
 * Không dùng useRef như guide Next.js của zustand: React 19 + react-compiler (đang bật trong
 * project) cấm đọc `ref.current` trong lúc render. useState là biến thể zustand dùng ở guide
 * initialize-state-with-props, cùng hiệu quả "chỉ chạy một lần" mà hợp luật render.
 *
 * Store đã có sẵn user ngay lần render đầu nên HTML do server sinh ra đã chứa dữ liệu —
 * không nháy `null`, không lệch hydrate.
 */
export function AuthStoreProvider({
  initialState,
  children,
}: {
  initialState: AuthState
  children: ReactNode
}) {
  const [store] = useState<AuthStoreApi>(() => createAuthStore(initialState))

  return <AuthStoreContext.Provider value={store}>{children}</AuthStoreContext.Provider>
}

/**
 * Input: Selector đọc phần state cần dùng.
 * Output: Giá trị đã subscribe. Gọi ngoài provider là lỗi lập trình nên ném luôn.
 */
export function useAuthStore<T>(selector: (store: AuthStore) => T): T {
  const store = useContext(AuthStoreContext)
  if (!store) throw new Error("useAuthStore phải được dùng bên trong AuthStoreProvider")

  return useStore(store, selector)
}
