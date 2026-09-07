"use client"

import { useEffect } from "react"
import { AppHeader } from "@/components/common/app-header"
import { AppShell } from "@/components/common/app-shell"
import { useOrganizations } from "@/hooks/use-organizations-api"
import { useOrganizationStore } from "@/stores/organization-store"

/**
 * Input: Nội dung trang thông tin cá nhân.
 * Output: Cùng khung có sidebar như khu vực tổ chức, để bấm "Thông tin cá nhân" trong menu tài
 *         khoản không làm mất sidebar rồi lại phải tìm đường về.
 *
 *         Trang này KHÔNG thuộc tổ chức nào (URL là `/me`, không phải `/orgs/<id>/me`) nhưng
 *         sidebar lại cần một tổ chức để dựng nút chuyển tổ chức — nên dùng
 *         `activeOrganizationId` mà BE trả kèm danh sách (nó đọc hộ cookie `org` và đã đối
 *         chiếu với chính danh sách đó). Đây là chỗ DUY NHẤT giá trị ấy được dùng ngoài `/`.
 *
 *         Chưa thuộc tổ chức nào → rơi về header phẳng: không có tổ chức thì không có gì để
 *         dựng sidebar, mà thông tin cá nhân vẫn phải sửa được.
 */
export default function MeLayout({ children }: { children: React.ReactNode }) {
  const { data } = useOrganizations()
  const setSnapshot = useOrganizationStore((state) => state.setSnapshot)
  const isStoreEmpty = useOrganizationStore((state) => state.organizations.length === 0)

  const active =
    data?.organizations.find((organization) => organization.id === data.activeOrganizationId) ??
    data?.organizations[0]

  useEffect(() => {
    if (data && active) {
      setSnapshot({ organizations: data.organizations, activeOrganizationId: active.id })
    }
  }, [data, active, setSnapshot])

  // Bất khả trong luồng thật (SessionGate đã chờ query xong), nhưng type thì vẫn là optional.
  if (!data) return null

  if (!active) {
    return (
      <>
        <AppHeader />
        {children}
      </>
    )
  }

  // Chỉ chặn ở lượt đầu, khi store còn rỗng — xem chú thích ở layout `/orgs/[orgId]`.
  if (isStoreEmpty) return null

  return <AppShell>{children}</AppShell>
}
