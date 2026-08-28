import { notFound } from "next/navigation"
import { fetchOrganizations } from "@/api/organizations.server"
import { AppShell } from "@/components/common/app-shell"
import { OrganizationStoreProvider } from "@/providers/organization-store-provider"

/**
 * Input: `orgId` trên URL + nội dung trang con.
 * Output: Chỗ DUY NHẤT gọi /organizations cho cả khu vực này — danh sách vừa để dựng nút chuyển
 *         tổ chức, vừa để các trang con đọc tổ chức đang xem, nên fetch một lần rồi bơm vào
 *         store thay vì mỗi trang tự gọi.
 *
 *         `orgId` không nằm trong danh sách → `notFound()`. Đây không phải trường hợp hiếm:
 *         bookmark cũ sau khi rời tổ chức, hay link dán cho người không phải thành viên. Cũng
 *         chính là chỗ bảo đảm mọi thứ bên dưới luôn tìm thấy tổ chức đang xem.
 *
 *         URL là nguồn sự thật của "đang xem tổ chức nào"; cookie `org` chỉ là bộ nhớ cho lần
 *         vào `/` sau. Nhờ vậy mở hai tab hai tổ chức vẫn đúng, và Back/Forward chạy tự nhiên.
 *
 *         Cũng là chỗ đọc cookie `sb` (sidebar đang thu hay mở) để truyền xuống khung: đọc ở
 *         server thì lần render đầu đã đúng trạng thái, không nháy cảnh mở rồi mới thu lại.
 *         Chưa có cookie → mở, vì lần đầu vào phải thấy có những gì để đi tới.
 */
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const result = await fetchOrganizations()

  if (!result.organizations) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  const current = result.organizations.find((organization) => organization.id === orgId)
  if (!current) notFound()

  return (
    <OrganizationStoreProvider
      initialState={{ organizations: result.organizations, activeOrganizationId: current.id }}
    >
      <AppShell>{children}</AppShell>
    </OrganizationStoreProvider>
  )
}
