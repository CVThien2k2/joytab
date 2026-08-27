"use client"

import { CalendarDays, Users } from "lucide-react"
import { OrganizationAccessCard } from "@/app/(private)/_components/organization-access-card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { MembersTable } from "./_components/members-table"
import { OrganizationDangerZone } from "./_components/organization-danger-zone"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch và khớp với URL).
 * Output: Trang duy nhất của một tổ chức: thông tin + cửa vào + danh sách thành viên + hành động
 *         rời/xoá.
 *
 *         MỘT trang chứ không tách hai tab: mỗi phần chỉ vài dòng, tách ra thì người dùng phải
 *         bấm qua lại để nắm được một thứ duy nhất là "tổ chức này đang thế nào". Khi nào có
 *         thêm nghiệp vụ (thu chi, báo cáo) thì đó mới là lúc thêm nav.
 *
 *         Là client component: tổ chức đọc từ store (server đã fetch ở layout), còn danh sách
 *         thành viên do React Query lấy — xem MembersTable.
 *
 *         Member KHÔNG thấy khu mời người vào (BE cũng không trả `joinCode` cho họ) nên phải nói
 *         ra một dòng vì sao — chỗ trống không giải thích được gì.
 */
export default function OrganizationPage() {
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight">{organization.name}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={isOwner ? "default" : "secondary"}>
          {isOwner ? "Chủ tổ chức" : "Thành viên"}
        </Badge>
        <Badge variant="outline">
          <Users aria-hidden="true" />
          {organization.memberCount} thành viên
        </Badge>
        <Badge variant="outline">
          <CalendarDays aria-hidden="true" />
          Bạn vào ngày {formatDate(organization.joinedAt)}
        </Badge>
      </div>

      {/* MỘT thẻ cho hai khối, cách nhau bằng đường kẻ trong thẻ (`divide-y`) chứ không tách
          thành nhiều thẻ rời: đều là cấu hình của cùng một tổ chức. Vì vậy từng khối bên dưới
          chỉ có padding, khung và viền do đây lo. */}
      <div className="mt-6 divide-y overflow-hidden rounded-xl border bg-card">
        {isOwner ? (
          <OrganizationAccessCard organization={organization} />
        ) : (
          <section className="p-4">
            <h2 className="text-sm font-semibold">Mời người vào tổ chức</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chỉ chủ tổ chức chia sẻ được mã tham gia. Cần mời thêm người thì nhờ chủ tổ chức gửi
              mã hoặc liên kết mời.
            </p>
          </section>
        )}

        <OrganizationDangerZone organization={organization} />
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold tracking-tight">Thành viên</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization.memberCount} người trong tổ chức, chủ tổ chức xếp trước.
        </p>

        <div className="mt-4">
          <MembersTable organizationId={organization.id} isOwner={isOwner} />
        </div>
      </section>
    </main>
  )
}
