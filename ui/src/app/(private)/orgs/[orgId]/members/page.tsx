import { fetchOrganizationMembers } from "@/api/organizations.server"
import { MemberList } from "./_components/member-list"

/**
 * Input: `orgId` trên URL.
 * Output: Trang danh sách thành viên của tổ chức đang xem.
 *
 *         Fetch ở page chứ không ở layout để `loading.tsx` bọc được — cùng lý do đã ghi ở
 *         layout của /onboarding. Layout của khu vực này chỉ giữ danh sách tổ chức; thành viên
 *         là dữ liệu riêng của trang này nên gọi riêng.
 *
 *         Không tự kiểm quyền: layout đã `notFound()` nếu `orgId` không thuộc user, và BE cũng
 *         chặn lần nữa (ORG_001) — FE không phải là chỗ giữ cửa.
 */
export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const result = await fetchOrganizationMembers(orgId)

  if (!result.members) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight">Thành viên</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.members.length} người trong tổ chức, chủ tổ chức xếp trước.
      </p>

      <div className="mt-5">
        <MemberList members={result.members} />
      </div>
    </main>
  )
}
