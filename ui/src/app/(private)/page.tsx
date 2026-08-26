import { fetchOrganizations } from "@/api/organizations.server"
import { InitSnapshot } from "./_components/init-snapshot"
import { OrganizationEmptyState } from "./_components/organization-empty-state"

/**
 * Input: Không nhận props.
 * Output: Ngã ba duy nhất của màn hình chính:
 *  - Chưa thuộc tổ chức nào → hai nút tham gia bằng mã / tạo tổ chức.
 *  - Đã có tổ chức → in dữ liệu init ra màn hình.
 *  - Không gọi được BE → hiện thẳng lý do, không error boundary.
 *
 *         Mảng rỗng KHÁC lỗi: `organizations: []` là trạng thái hợp lệ của user mới, nên phải
 *         kiểm tra `null` (lỗi) trước rồi mới xét `length`.
 *
 *         Fetch nằm ở page chứ không ở layout để `loading.tsx` (nếu thêm sau) bọc được — cùng
 *         lý do đã ghi ở layout của /onboarding.
 */
export default async function HomePage() {
  const result = await fetchOrganizations()

  if (!result.organizations) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  if (result.organizations.length === 0) {
    return <OrganizationEmptyState />
  }

  return <InitSnapshot organizations={result.organizations} />
}
