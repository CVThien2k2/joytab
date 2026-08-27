"use client"

import { CalendarDays, Users } from "lucide-react"
import { OrganizationAccessCard } from "@/app/(private)/_components/organization-access-card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useActiveOrganization } from "@/providers/organization-store-provider"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch và khớp với URL).
 * Output: Trang thông tin tổ chức: tên, vai trò của bạn, số thành viên, ngày bạn vào; owner
 *         thấy thêm khu điều khiển cửa vào bằng mã.
 *
 *         Là client component đọc store thay vì server component fetch lại: layout vừa gọi
 *         /organizations xong, gọi lần nữa ở đây là hai request cho cùng một dữ liệu trong
 *         cùng một lần render.
 *
 *         Member KHÔNG thấy khu mời người vào (BE cũng không trả `joinCode` cho họ) nên phải
 *         nói ra một dòng vì sao — chỗ trống không giải thích được gì.
 */
export default function OrganizationOverviewPage() {
  const organization = useActiveOrganization()

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight">{organization.name}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={organization.role === "owner" ? "default" : "secondary"}>
          {organization.role === "owner" ? "Chủ tổ chức" : "Thành viên"}
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

      <div className="mt-6">
        {organization.role === "owner" ? (
          <OrganizationAccessCard organization={organization} />
        ) : (
          <section className="rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Mời người vào tổ chức</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chỉ chủ tổ chức chia sẻ được mã tham gia. Cần mời thêm người thì nhờ chủ tổ chức gửi
              mã hoặc liên kết mời.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
