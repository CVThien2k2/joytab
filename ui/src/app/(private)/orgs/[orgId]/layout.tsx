"use client"

import { useEffect } from "react"
import { notFound, useParams } from "next/navigation"
import { AppShell } from "@/components/common/app-shell"
import { useOrganizations } from "@/hooks/use-organizations-api"
import { useOrganizationStore } from "@/stores/organization-store"

/**
 * Input: `orgId` trên URL + nội dung trang con.
 * Output: Bơm danh sách tổ chức + tổ chức đang xem vào store rồi tới khung có sidebar.
 *
 *         Chạy ở CLIENT và đọc từ cache: SessionGate (layout `(private)`) đã gọi /organizations
 *         và chờ xong trước khi render tới đây, nên `useOrganizations()` ở đây luôn có dữ liệu
 *         ngay — không nháy loading lần hai, không gọi thêm request nào.
 *
 *         `orgId` không nằm trong danh sách → `notFound()`. Đây không phải trường hợp hiếm:
 *         bookmark cũ sau khi rời tổ chức, hay link dán cho người không phải thành viên. Cũng
 *         chính là chỗ bảo đảm mọi thứ bên dưới luôn tìm thấy tổ chức đang xem.
 *
 *         URL là nguồn sự thật của "đang xem tổ chức nào"; `activeOrganizationId` mà BE trả về
 *         (đọc từ cookie `org`) chỉ là bộ nhớ cho lần vào `/` sau. Nhờ vậy mở hai tab hai tổ
 *         chức vẫn đúng, và Back/Forward chạy tự nhiên.
 *
 *         Chỉ chặn render ở lượt ĐẦU (store còn rỗng): lúc đó `useActiveOrganization` chưa có gì
 *         để trả và sẽ ném lỗi. Còn khi đổi tổ chức thì store đã có ảnh cũ — vẫn hợp lệ — nên cứ
 *         render, effect bơm ảnh mới ngay nhịp sau, đỡ một khoảng trắng giữa hai tổ chức.
 */
export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ orgId: string }>()
  const { data } = useOrganizations()
  const setSnapshot = useOrganizationStore((state) => state.setSnapshot)
  const isStoreEmpty = useOrganizationStore((state) => state.organizations.length === 0)

  const current = data?.organizations.find((organization) => organization.id === params.orgId)

  useEffect(() => {
    if (data && current) {
      setSnapshot({ organizations: data.organizations, activeOrganizationId: current.id })
    }
  }, [data, current, setSnapshot])

  // Bất khả trong luồng thật (SessionGate đã chờ query xong), nhưng type thì vẫn là optional.
  if (!data) return null

  if (!current) notFound()

  if (isStoreEmpty) return null

  return <AppShell>{children}</AppShell>
}
