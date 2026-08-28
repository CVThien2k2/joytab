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
 * Trang của chính user, không treo tổ chức lên trước: đây là thông tin tài khoản, không đổi
 * khi người dùng chuyển tổ chức đang xem.
 */
const PERSONAL_LABELS: Record<string, string> = {
  "/me": "Thông tin cá nhân",
}

/** Nhãn của các trang con trong một tổ chức, theo segment ngay sau `/orgs/<id>`. */
const ORGANIZATION_LABELS: Record<string, string> = {
  matches: "Lịch thi đấu",
  payments: "Thanh toán",
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
 *         `/me` chỉ có MỘT mẩu — nó là trang tài khoản, treo tên tổ chức lên trước là sai.
 *         Trang trong tổ chức thì bắt đầu bằng tên tổ chức rồi mới tới mục con.
 */
export function useBreadcrumb(): Crumb[] {
  const pathname = usePathname()
  const organizations = useOrganizationStore((state) => state.organizations)
  const activeId = useOrganizationStore((state) => state.activeOrganizationId)

  const personalLabel = PERSONAL_LABELS[pathname]
  if (personalLabel) return [{ href: pathname, label: personalLabel, current: true }]

  const active = organizations.find((organization) => organization.id === activeId)
  if (!active) return []

  const root = `/orgs/${active.id}`
  if (!pathname.startsWith(root)) return []

  // "" ở trang gốc, "matches" hoặc "payments" ở trang con, và có thể còn id trận phía sau.
  const rest = pathname.slice(root.length).split("/").filter(Boolean)
  if (rest.length === 0) return [{ href: root, label: active.name, current: true }]

  const sectionLabel = ORGANIZATION_LABELS[rest[0]]
  if (!sectionLabel) return [{ href: root, label: active.name, current: true }]

  const sectionHref = `${root}/${rest[0]}`
  const crumbs: Crumb[] = [
    { href: root, label: active.name, current: false },
    { href: sectionHref, label: sectionLabel, current: rest.length === 1 },
  ]

  // Trang chi tiết trận: tên sân chỉ biết sau khi fetch, mà breadcrumb thì render ngay — nên
  // dùng một nhãn cố định thay vì để trống một nhịp rồi mới nhảy ra chữ.
  if (rest.length > 1) {
    crumbs.push({ href: pathname, label: "Chi tiết trận", current: true })
  }

  return crumbs
}
