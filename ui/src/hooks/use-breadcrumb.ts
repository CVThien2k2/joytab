"use client"

import { usePathname } from "next/navigation"
import { useOrganizationStore } from "@/providers/organization-store-provider"

/** Một mẩu breadcrumb. `current` = trang đang đứng, không render thành link. */
export type Crumb = {
  href: string
  label: string
  current: boolean
}

/**
 * Input: Không nhận tham số — suy từ pathname và store tổ chức.
 * Output: Danh sách breadcrumb của trang đang mở. Route lạ trả mảng rỗng (header khi đó chỉ
 *         trống chứ không hiện một mẩu sai).
 *
 *         Suy theo route thay vì để mỗi page tự khai: thêm trang mới mà quên khai thì header
 *         trống, còn suy ở một chỗ thì mọi trang đều có breadcrumb. Cùng cách hub làm
 *         (hooks/use-breadcrumb.ts).
 *
 *         Nhãn của tổ chức lấy từ store (server đã fetch ở layout) nên không có nhịp "đang tải"
 *         như hub — bên đó tên tổ chức đến từ query nên phải có skeleton.
 *
 *         Hiện tại mỗi trang chỉ có MỘT mẩu: trong tổ chức thì là tên tổ chức, còn `/me` là trang
 *         riêng của user nên chỉ có tên trang, không treo tổ chức lên trước. Giữ dạng mảng để khi
 *         có trang con (vd /orgs/<id>/thu-chi) thì thêm cấp mà không phải viết lại component.
 */
export function useBreadcrumb(): Crumb[] {
  const pathname = usePathname()
  const organizations = useOrganizationStore((state) => state.organizations)
  const activeId = useOrganizationStore((state) => state.activeOrganizationId)

  if (pathname === "/me") {
    // KHÔNG chèn tổ chức đứng trước: đây là trang của chính user, không thuộc tổ chức nào. Sidebar
    // vẫn là sidebar của tổ chức đang xem, nhưng đó là khung chứa — breadcrumb nói về NỘI DUNG
    // đang mở, và nội dung này không đổi khi chuyển tổ chức.
    return [{ href: "/me", label: "Thông tin cá nhân", current: true }]
  }

  const active = organizations.find((organization) => organization.id === activeId)
  if (!active) return []

  const href = `/orgs/${active.id}`
  return pathname === href ? [{ href, label: active.name, current: true }] : []
}
