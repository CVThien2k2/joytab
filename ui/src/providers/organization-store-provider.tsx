"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useStore } from "zustand"
import {
  createOrganizationStore,
  type OrganizationState,
  type OrganizationStore,
} from "@/stores/organization-store"

export type OrganizationStoreApi = ReturnType<typeof createOrganizationStore>

const OrganizationStoreContext = createContext<OrganizationStoreApi | null>(null)

/**
 * Input: `initialState` do layout `/orgs/[orgId]` fetch sẵn + children.
 * Output: Store danh sách tổ chức, tạo một lần cho mỗi lần mount và đưa xuống qua context.
 *
 * useState với initializer (không phải useRef) — cùng lý do đã ghi ở AuthStoreProvider:
 * react-compiler cấm đọc `ref.current` lúc render.
 *
 * Khác AuthStoreProvider ở chỗ có thêm effect đồng bộ: danh sách này ĐỔI trong lúc app đang
 * chạy (tạo tổ chức, tham gia bằng mã, đổi công tắc mã tham gia đều `router.refresh()`), mà
 * initializer của useState chỉ chạy một lần nên store sẽ đứng lại ở ảnh cũ. So sánh trước khi
 * ghi để lần render không có gì đổi thì không đánh thức component nào.
 */
export function OrganizationStoreProvider({
  initialState,
  children,
}: {
  initialState: OrganizationState
  children: ReactNode
}) {
  const [store] = useState<OrganizationStoreApi>(() => createOrganizationStore(initialState))

  // Không có mảng dependency: `initialState` là object mới mỗi lần render nên mảng nào cũng
  // vô nghĩa; việc so sánh thật nằm ngay bên trong.
  useEffect(() => {
    const current = store.getState()
    const changed =
      current.activeOrganizationId !== initialState.activeOrganizationId ||
      JSON.stringify(current.organizations) !== JSON.stringify(initialState.organizations)
    if (changed) store.setState(initialState)
  })

  return (
    <OrganizationStoreContext.Provider value={store}>{children}</OrganizationStoreContext.Provider>
  )
}

/**
 * Input: Selector đọc phần state cần dùng.
 * Output: Giá trị đã subscribe. Gọi ngoài provider là lỗi lập trình nên ném luôn.
 */
export function useOrganizationStore<T>(selector: (store: OrganizationStore) => T): T {
  const store = useContext(OrganizationStoreContext)
  if (!store) {
    throw new Error("useOrganizationStore phải được dùng bên trong OrganizationStoreProvider")
  }

  return useStore(store, selector)
}

/**
 * Input: Không nhận tham số.
 * Output: Tổ chức đang xem. Không tìm thấy là bất khả: layout đã `notFound()` khi `orgId` trên
 *         URL không thuộc danh sách, nên tới được đây thì id luôn khớp một phần tử.
 */
export function useActiveOrganization() {
  return useOrganizationStore((state) => {
    const active = state.organizations.find(
      (organization) => organization.id === state.activeOrganizationId,
    )
    if (!active) throw new Error("Tổ chức đang xem không có trong danh sách")
    return active
  })
}
