import { fetchOrganizations, readActiveOrganizationId } from "@/api/organizations.server"
import { AppHeader } from "@/components/common/app-header"
import { AppShell } from "@/components/common/app-shell"
import { OrganizationStoreProvider } from "@/providers/organization-store-provider"

/**
 * Input: Nội dung trang thông tin cá nhân.
 * Output: Cùng khung có sidebar như khu vực tổ chức, để bấm nav "Thông tin cá nhân" không làm
 *         mất sidebar rồi lại phải tìm đường về.
 *
 *         Trang này KHÔNG thuộc tổ chức nào (URL là `/me`, không phải `/orgs/<id>/me`) nhưng
 *         sidebar lại cần một tổ chức để dựng nút chuyển tổ chức — nên lấy tổ chức xem lần gần
 *         nhất từ cookie `org`, không khớp thì lấy phần tử đầu. Đây là chỗ DUY NHẤT cookie đó
 *         được dùng ngoài redirect ở `/`.
 *
 *         Chưa thuộc tổ chức nào → rơi về header phẳng: không có tổ chức thì không có gì để
 *         dựng sidebar, mà thông tin cá nhân vẫn phải sửa được.
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const [result, rememberedId] = await Promise.all([
    fetchOrganizations(),
    readActiveOrganizationId(),
  ])

  if (!result.organizations) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  if (result.organizations.length === 0) {
    return (
      <>
        <AppHeader />
        {children}
      </>
    )
  }

  const active =
    result.organizations.find((organization) => organization.id === rememberedId) ??
    result.organizations[0]

  return (
    <OrganizationStoreProvider
      initialState={{ organizations: result.organizations, activeOrganizationId: active.id }}
    >
      <AppShell>{children}</AppShell>
    </OrganizationStoreProvider>
  )
}
