"use client"

import { useState } from "react"
import { CalendarDays, Pencil, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import type { Organization } from "@/types/organization"
import { EditOrganizationDialog } from "./edit-organization-dialog"

/**
 * Input: Tổ chức đang xem.
 * Output: Khối thông tin tổ chức: tên, vai trò của bạn, số thành viên, ngày bạn vào — kèm nút
 *         sửa cho owner.
 *
 *         Nút sửa CHỈ hiện với owner: member gọi PATCH sẽ ăn ORG_004, hiện nút cho họ là hứa một
 *         việc không làm được.
 *
 *         Chỉ có padding, KHÔNG có khung riêng: đây là một khối trong thẻ chung của trang, khung
 *         và đường kẻ ngăn cách do trang lo.
 */
export function OrganizationInfoCard({ organization }: { organization: Organization }) {
  const [editing, setEditing] = useState(false)
  const isOwner = organization.role === "owner"

  return (
    <>
      <section className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight">
              {organization.name}
            </h2>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
          </div>

          {isOwner ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Sửa thông tin
            </Button>
          ) : null}
        </div>
      </section>

      {isOwner ? (
        <EditOrganizationDialog
          organization={organization}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}
