"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, PanelLeft } from "lucide-react"
import { JoytabLogo } from "@/components/common/joytab-logo"
import { RailTooltip } from "@/components/common/rail-tooltip"
import { SidebarProfileMenu } from "@/components/common/sidebar-profile-menu"
import { useSidebar } from "@/components/common/sidebar-provider"
import { useOrganizationStore } from "@/providers/organization-store-provider"
import { cn } from "@/lib/utils"

/**
 * Các nav của một tổ chức. Hiện chỉ có một mục vì cả tổ chức gọn trong một trang (thông tin +
 * thành viên); vẫn để dạng mảng vì thêm nghiệp vụ sau (thu chi, báo cáo) là thêm phần tử ở đây,
 * không phải viết lại vòng render.
 *
 * `segment` rỗng = chính `/orgs/<id>`.
 */
const NAV_ITEMS = [{ segment: "", label: "Tổ chức", icon: Building2 }] as const

/**
 * Input: `onNavigate` — gọi sau khi bấm vào một nav (bản mobile dùng để đóng tấm trượt).
 * Output: Ruột của sidebar: khối logo, danh sách nav, rồi nút tài khoản ép xuống đáy.
 *
 *         Dùng chung cho cả cột trên desktop và tấm trượt trên mobile — hai chỗ hiển thị, một
 *         định nghĩa. Vì vậy MỌI lớp phụ thuộc trạng thái thu gọn đều có tiền tố `md:`: tấm
 *         trượt trên mobile luôn rộng nên luôn hiện đầy đủ chữ, bất kể cột desktop đang thu hay
 *         mở. Cùng cách hub làm (components/sidebar/sidebar-nav.tsx).
 *
 *         Thu gọn KHÔNG tháo chữ khỏi DOM, chỉ cho `opacity` về 0: tháo ra thì chữ biến mất
 *         tức thời trong khi cột còn đang hẹp dần, thấy được thành một nhịp giật.
 *
 *         Mục con (khi có) nhận diện bằng `pathname.startsWith(href)` để trang con vẫn làm nav
 *         cha sáng; riêng mục gốc `/orgs/<id>` phải so BẰNG vì nó là tiền tố của mọi đường khác.
 */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const activeId = useOrganizationStore((state) => state.activeOrganizationId)
  const { open, toggle } = useSidebar()
  const collapsed = !open

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Khối logo cao 64px, khớp đúng bề rộng rail khi thu gọn nên icon nằm chính giữa ô
          vuông 64×64 — mắt không thấy nó xê dịch lúc cột co lại. */}
      <div className="relative h-16 shrink-0">
        {/* Bản rail: chỉ hiện trên desktop khi đã thu. Hover thì logo mờ đi, nút mở hiện ra
            đúng chỗ đó — không cần thêm một nút thường trực chiếm chỗ trên rail 64px.
            Lấy nguyên ý từ hub (components/sidebar/sidebar-brand.tsx). */}
        <RailTooltip label="Mở thanh điều hướng" enabled={collapsed}>
          <button
            type="button"
            onClick={toggle}
            className={cn(
              "group/brand absolute top-0 left-0 hidden size-16 cursor-pointer items-center justify-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
              collapsed && "md:flex",
            )}
            aria-label="Mở thanh điều hướng"
          >
            <JoytabLogo
              iconOnly
              className="h-7 w-auto transition-opacity duration-150 group-hover/brand:opacity-0"
            />
            <PanelLeft
              className="absolute size-5 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/brand:opacity-100"
              aria-hidden="true"
            />
          </button>
        </RailTooltip>

        {/* Bản đầy đủ: luôn hiện trên mobile, ẩn trên desktop khi đã thu. */}
        <div
          className={cn("absolute inset-0 flex items-center gap-2 px-4", collapsed && "md:hidden")}
        >
          <Link
            href={`/orgs/${activeId}`}
            onClick={onNavigate}
            className="flex min-w-0 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Joytab — trang chủ tổ chức"
          >
            <JoytabLogo className="h-9 w-auto" />
          </Link>
        </div>
      </div>

      <nav
        aria-label="Điều hướng tổ chức"
        className={cn(
          // pt-8 giãn nav xuống khỏi khối logo (hub cũng giãn, ở mức pt-4): logo là nhận diện,
          // nav là điều hướng — dán sát nhau thì mắt đọc thành một danh sách mà dòng đầu vô tình
          // trông như một mục bấm được.
          "flex min-h-0 flex-1 flex-col gap-2 pt-8 pb-2",
          collapsed ? "px-3 md:px-2.5" : "px-3",
        )}
      >
        {NAV_ITEMS.map((item) => {
          const href = item.segment ? `/orgs/${activeId}/${item.segment}` : `/orgs/${activeId}`
          // Mục gốc phải so BẰNG, không `startsWith`: `/orgs/<id>` là tiền tố của mọi trang con
          // nên startsWith sẽ làm nó sáng cùng lúc với mục con sau này.
          const isActive = item.segment ? pathname.startsWith(href) : pathname === href
          const Icon = item.icon

          return (
            <RailTooltip key={item.label} label={item.label} enabled={collapsed}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // Mọi item cùng chiều cao và cùng độ đậm, kể cả item đang mở: đổi
                  // `font-weight` theo trạng thái làm chữ nở ra, hai nav cạnh nhau trông lệch
                  // nhau như hai cấp khác nhau. Trạng thái nói bằng nền + độ tương phản chữ.
                  "flex h-10 items-center gap-3 overflow-hidden rounded-lg px-[13px] text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-5 shrink-0", isActive ? "text-primary" : "text-current")}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left transition-opacity duration-150",
                    collapsed && "md:opacity-0",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </RailTooltip>
          )
        })}
      </nav>

      <div className={cn("shrink-0 border-t py-2", collapsed ? "px-3 md:px-2.5" : "px-3")}>
        <SidebarProfileMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
