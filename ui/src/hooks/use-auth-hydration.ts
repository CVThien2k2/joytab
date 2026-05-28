"use client"

import { useSyncExternalStore } from "react"
import { useAuthStore } from "@/stores/auth-store"

const emptySubscribe = () => () => undefined

/**
 * Input: Callback cần gọi khi trạng thái hydrate của auth store đổi.
 * Output: Hàm hủy đăng ký listener hydrate.
 */
function subscribeAuthHydration(onStoreChange: () => void) {
  if (!useAuthStore.persist) {
    return emptySubscribe()
  }

  const unsubscribeFinish = useAuthStore.persist.onFinishHydration(onStoreChange)
  const unsubscribeHydrate = useAuthStore.persist.onHydrate(onStoreChange)

  return () => {
    unsubscribeFinish()
    unsubscribeHydrate()
  }
}

/**
 * Input: Không nhận tham số.
 * Output: Trạng thái hydrate hiện tại của auth store ở client.
 */
function getAuthHydrationSnapshot() {
  return Boolean(useAuthStore.persist?.hasHydrated())
}

/**
 * Input: Không nhận tham số, đọc trạng thái hydrate từ Zustand persist.
 * Output: Trả true khi store auth đã hydrate xong từ localStorage.
 */
export function useAuthHydration() {
  return useSyncExternalStore(
    subscribeAuthHydration,
    getAuthHydrationSnapshot,
    () => false,
  )
}
