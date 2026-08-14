"use client"

import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { LogoutButton } from "@/components/common/logout-button"
import { ThemeModeButton } from "@/components/common/theme-mode-button"
import { useAuthStore } from "@/stores/auth-store"
import type { MemberRole } from "@/types/organization"
import { OrgSwitcher } from "./org-switcher"

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

/**
 * Input: orgId để dựng href.
 * Output: Toàn bộ menu của nhóm. Mục `adminOnly` bị lọc bỏ khi role là MEMBER — chỉ để cho
 *         gọn mắt, quyền thật vẫn do BE chặn (ORG_003).
 */
function buildNavItems(orgId: string): NavItem[] {
  const base = `/orgs/${orgId}`

  return [
    { href: base, label: "Tổng quan", icon: LayoutDashboard },
    { href: `${base}/events`, label: "Buổi đánh", icon: CalendarDays },
    { href: `${base}/debts`, label: "Công nợ của tôi", icon: Wallet },
    {
      href: `${base}/templates`,
      label: "Lịch định kỳ",
      icon: CalendarClock,
      adminOnly: true,
    },
    { href: `${base}/members`, label: "Thành viên", icon: Users, adminOnly: true },
    {
      href: `${base}/payments`,
      label: "Duyệt thanh toán",
      icon: ReceiptText,
      adminOnly: true,
    },
  ]
}

type OrgSidebarProps = {
  orgId: string
  orgName?: string
  myRole?: MemberRole
}

export function OrgSidebar({ orgId, orgName, myRole }: OrgSidebarProps) {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const items = buildNavItems(orgId).filter(
    (item) => !item.adminOnly || myRole === "ADMIN",
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OrgSwitcher orgId={orgId} orgName={orgName} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quản lý</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <p className="truncate px-2 text-sm font-medium">
            {user?.user.fullName ?? user?.user.email}
          </p>
          <div className="mt-2 flex items-center gap-2 px-2">
            <LogoutButton />
            <ThemeModeButton />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
