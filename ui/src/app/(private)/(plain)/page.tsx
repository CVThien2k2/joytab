import { redirect } from "next/navigation"
import { fetchOrganizations, readActiveOrganizationId } from "@/api/organizations.server"
import { OrganizationEmptyState } from "../_components/organization-empty-state"

/**
 * Input: Không nhận props.
 * Output: Ngã ba của lối vào app, không tự vẽ UI tổ chức:
 *  - Không gọi được BE → hiện thẳng lý do, không error boundary.
 *  - Chưa thuộc tổ chức nào → hai nút tham gia bằng mã / tạo tổ chức.
 *  - Đã có tổ chức → đá sang `/orgs/<id>/overview`.
 *
 *         Mảng rỗng KHÁC lỗi: `organizations: []` là trạng thái hợp lệ của user mới, nên phải
 *         kiểm tra `null` (lỗi) trước rồi mới xét `length`.
 *
 *         Đích của redirect là tổ chức xem lần gần nhất (cookie `org`), nhưng CHỈ khi id đó
 *         còn nằm trong danh sách thật — user có thể đã rời tổ chức đó từ máy khác, hoặc cookie
 *         là của tài khoản trước trên cùng browser. Không khớp thì về phần tử đầu (BE sắp theo
 *         `joined_at` tăng dần nên "đầu" là tổ chức lâu nhất, ổn định giữa các lần gọi).
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

  const rememberedId = await readActiveOrganizationId()
  const target =
    result.organizations.find((organization) => organization.id === rememberedId) ??
    result.organizations[0]

  redirect(`/orgs/${target.id}/overview`)
}
