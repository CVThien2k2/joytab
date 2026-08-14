"use client"

import { use, type ReactNode } from "react"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useOrganization } from "@/hooks/use-organizations"
import { OrgSidebar } from "./org-sidebar"

type OrgShellProps = {
  params: Promise<{ orgId: string }>
  children: ReactNode
}

/**
 * Input: `params` của route (Next 16 trả về Promise) và nội dung trang.
 * Output: Khung sidebar dùng chung cho mọi màn hình trong một nhóm.
 *
 * `GET /organizations/:orgId` gọi ở đây một lần rồi cache: nó vừa là nguồn tên nhóm cho
 * breadcrumb, vừa là nguồn `myRole` để lọc menu. Trang con muốn biết role thì đọc lại từ
 * cùng query key, không gọi thêm.
 */
export function OrgShell({ params, children }: OrgShellProps) {
  const { orgId } = use(params)
  const { data: organization } = useOrganization(orgId)

  return (
    <SidebarProvider>
      <OrgSidebar
        orgId={orgId}
        orgName={organization?.name}
        myRole={organization?.myRole}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="truncate text-sm font-medium">
            {organization?.name ?? "Đang tải…"}
          </span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
