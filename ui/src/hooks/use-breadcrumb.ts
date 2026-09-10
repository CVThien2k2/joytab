"use client"

import { usePathname } from "next/navigation"
import { useMatch } from "@/hooks/use-matches-api"
import { useOrganizationStore } from "@/stores/organization-store"

/** Một mẩu breadcrumb. `current` = trang đang đứng, không render thành link. */
export type Crumb = {
  href: string
  label: string
  current: boolean
}

/**
 * Nhãn của các trang con trong một tổ chức, theo segment ngay sau `/orgs/<id>`.
 *
 * Mỗi segment ở đây là một trang THẬT bấm vào được. Chi tiết trận không có mục riêng: nó là
 * trang con của `org-history`, nên mượn luôn mẩu này làm mẩu cha — xem nhánh ở cuối hook.
 */
const ORGANIZATION_LABELS: Record<string, string> = {
  history: "Trận của tôi",
  "org-history": "Lịch sử tổ chức",
  settings: "Tổ chức",
}

/**
 * Input: pathname hiện tại.
 * Output: Id trận nếu đang ở `/orgs/<orgId>/org-history/<matchId>`, ngược lại chuỗi rỗng.
 *
 * Đọc thẳng từ pathname chứ không đợi biết tổ chức nào đang mở: hook lấy tên trận phải được
 * gọi TRƯỚC mấy nhánh trả sớm ở dưới, mà lúc đó `active` có thể chưa có.
 */
function matchIdOf(pathname: string): string {
  return /^\/orgs\/[^/]+\/org-history\/([^/]+)/.exec(pathname)?.[1] ?? ""
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
 *         Mọi trang còn lại đều nằm trong một tổ chức, nên breadcrumb luôn bắt đầu bằng tên tổ
 *         chức rồi mới tới mục con. Hồ sơ cá nhân không có mặt ở đây nữa: nó là một hộp thoại,
 *         mà hộp thoại thì không đổi trang nên cũng không có mẩu breadcrumb nào để thêm.
 */
export function useBreadcrumb(): Crumb[] {
  const pathname = usePathname()
  const organizations = useOrganizationStore((state) => state.organizations)
  const activeId = useOrganizationStore((state) => state.activeOrganizationId)

  // Gọi VÔ ĐIỀU KIỆN, trước mọi nhánh trả sớm — hook không gọi có điều kiện được. Ở route
  // không phải chi tiết trận thì `matchId` rỗng và query tự tắt.
  const matchId = matchIdOf(pathname)
  const { data: match } = useMatch(matchId, matchId !== "")

  const active = organizations.find((organization) => organization.id === activeId)
  if (!active) return []

  const root = `/orgs/${active.id}`
  if (!pathname.startsWith(root)) return []

  // "" ở trang chủ, "history"/"org-history"/"settings" ở trang con, và "org-history/<matchId>"
  // ở trang chi tiết trận — hai mẩu.
  const rest = pathname.slice(root.length).split("/").filter(Boolean)
  if (rest.length === 0) return [{ href: root, label: active.name, current: true }]

  const sectionLabel = ORGANIZATION_LABELS[rest[0]]
  if (!sectionLabel) return [{ href: root, label: active.name, current: true }]

  const sectionHref = `${root}/${rest[0]}`
  const crumbs: Crumb[] = [
    { href: root, label: active.name, current: false },
    { href: sectionHref, label: sectionLabel, current: rest.length === 1 },
  ]

  // Chi tiết trận — trang con DUY NHẤT có thêm một tầng, treo dưới "Lịch sử tổ chức". Mẩu cuối
  // là TÊN SÂN lấy từ API, dùng chung query với chính trang đang mở nên không tốn thêm request.
  // Trong lúc chờ (và khi trận không tải được) thì rơi về "Chi tiết trận": để trống một nhịp
  // rồi mới nhảy ra chữ còn khó đọc hơn một nhãn chung chung.
  if (rest.length > 1) {
    crumbs.push({ href: pathname, label: match?.courtName ?? "Chi tiết trận", current: true })
  }

  return crumbs
}
