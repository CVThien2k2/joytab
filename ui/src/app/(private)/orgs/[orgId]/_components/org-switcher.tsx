"use client"

import { ChevronsUpDown, Plus, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganizations } from "@/hooks/use-organizations"

type OrgSwitcherProps = {
  orgId: string
  orgName?: string
}

/**
 * Input: orgId đang mở và tên nhóm (nếu đã tải xong).
 * Output: Nút đầu sidebar để nhảy nhanh giữa các nhóm, kèm lối tạo nhóm mới.
 *
 * Tên nhóm nhận qua prop thay vì tự fetch: layout đã gọi `useOrganization` rồi, để component
 * này fetch lại chỉ tạo thêm một lần chớp nháy khi danh sách nhóm về chậm hơn.
 */
export function OrgSwitcher({ orgId, orgName }: OrgSwitcherProps) {
  const router = useRouter()
  const { data: organizations } = useOrganizations()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Users className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {orgName ?? <Skeleton className="h-4 w-24" />}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  Nhóm cầu lông
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Nhóm của tôi
            </DropdownMenuLabel>
            {organizations?.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onSelect={() => router.push(`/orgs/${organization.id}`)}
                className={organization.id === orgId ? "bg-accent" : undefined}
              >
                <span className="truncate">{organization.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/orgs/new">
                <Plus className="size-4" />
                Tạo nhóm mới
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
