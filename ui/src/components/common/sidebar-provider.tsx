"use client"

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react"
import { SIDEBAR_DEFAULT_OPEN, SIDEBAR_STORAGE_KEY } from "@/lib/sidebar-storage"

/**
 * Các component đang hiển thị sidebar, để một lần thu/mở là mọi chỗ cùng đổi.
 *
 * Trạng thái nằm trong localStorage chứ không trong React state: localStorage sống qua lần tải
 * sau, còn React state chỉ sống trong một lượt mount. Để React giữ bản chính thì mỗi lần
 * provider mount lại (đổi layout, tải lại trang) là một lần phải đi hỏi lại nơi lưu — hỏi trễ
 * một nhịp là cột mở sai. Ở đây React chỉ ĐỌC nơi lưu qua `useSyncExternalStore`.
 */
const listeners = new Set<() => void>()

/**
 * Input: Không nhận tham số.
 * Output: Trạng thái đang lưu; rơi về mặc định khi chưa lưu gì hoặc không đọc được.
 *
 *         Bọc try/catch vì `localStorage` NÉM khi bị chặn chứ không trả rỗng. Một sidebar không
 *         nhớ được là phiền; một sidebar làm sập trang vì đi đọc chỗ nhớ thì là lỗi.
 */
function readOpen(): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return stored === null ? SIDEBAR_DEFAULT_OPEN : stored !== "0"
  } catch {
    return SIDEBAR_DEFAULT_OPEN
  }
}

/**
 * Input: Trạng thái vừa chọn.
 * Output: Ghi vào localStorage, đóng dấu lại lên `<html>`, rồi báo cho mọi component đang đọc.
 *
 *         Dấu trên `<html>` phải đổi NGAY tại đây chứ không đợi effect: mọi class phụ thuộc
 *         trạng thái thu đều treo vào nó, chờ thêm một vòng effect là cột nhấp một nhịp sai.
 */
function writeOpen(open: boolean): void {
  document.documentElement.dataset.sidebar = open ? "open" : "closed"
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "1" : "0")
  } catch {
    // Chặn storage thì phiên này vẫn thu/mở bình thường, chỉ là lần sau không nhớ.
  }
  for (const listener of listeners) listener()
}

/**
 * Input: Hàm React gọi lại mỗi khi trạng thái đổi.
 * Output: Hàm huỷ đăng ký.
 *
 *         Nghe thêm sự kiện `storage` — sự kiện này chỉ bắn ở các TAB KHÁC, nên mở hai tab thì
 *         thu ở tab này, tab kia thu theo, không còn cảnh hai tab nói hai kiểu rồi tab nào ghi
 *         sau thì thắng.
 */
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)

  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Server không có localStorage nên trả mặc định; script ở app/layout.tsx lo phần vẽ đúng. */
function getServerSnapshot(): boolean {
  return SIDEBAR_DEFAULT_OPEN
}

type SidebarContextValue = {
  open: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

/**
 * Input: Children của khu vực có sidebar.
 * Output: Cấp trạng thái thu/mở cho cả khung.
 *
 *         KHÔNG còn nhận `initialOpen` từ server và không còn đóng dấu `data-sidebar` lên div
 *         bọc: dấu đó giờ nằm trên `<html>`, do script trong app/layout.tsx đặt trước khi trang
 *         được vẽ và do `writeOpen` cập nhật sau mỗi lần bấm. Nhờ vậy khung hình ĐẦU TIÊN đã
 *         đúng trạng thái, không phải chờ React hydrate.
 *
 *         `useSyncExternalStore` chứ không `useState`: đây là API React dựng riêng cho cảnh
 *         "nguồn sự thật nằm ngoài React", và nó xử đúng lượt hydrate — dùng `getServerSnapshot`
 *         để khớp HTML của server rồi tự render lại bằng giá trị thật, thay vì báo lệch HTML
 *         như khi tự đọc localStorage trong `useState`.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const open = useSyncExternalStore(subscribe, readOpen, getServerSnapshot)

  return (
    <SidebarContext.Provider value={{ open, toggle: () => writeOpen(!open) }}>
      <div className="flex min-h-0 flex-1">{children}</div>
    </SidebarContext.Provider>
  )
}

/**
 * Input: Không nhận tham số.
 * Output: Trạng thái sidebar + hàm thu/mở. Gọi ngoài provider là lỗi lập trình nên ném luôn.
 */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) throw new Error("useSidebar phải được dùng bên trong SidebarProvider")

  return context
}
