"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, CircleUser, PanelLeft } from "lucide-react"
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
 * Input: Mục này có đang mở hay không.
 * Output: Class của một hàng nav.
 *
 *         Tách ra hàm vì có hai nhóm nav dùng nó (nav tổ chức và nav "Thông tin cá nhân"):
 *         hai chỗ tự viết class là hai chỗ sẽ trôi mỗi cái một kiểu.
 *
 *         Mọi hàng cùng chiều cao và cùng độ đậm, kể cả hàng đang mở: đổi `font-weight` theo
 *         trạng thái làm chữ nở ra, hai nav cạnh nhau trông lệch nhau như hai cấp khác nhau.
 *         Trạng thái nói bằng nền + độ tương phản của chữ, lấy từ bộ token `--sidebar-*`
 *         của theme. Icon KHÔNG có màu riêng: nó `text-current`, tức là đi theo màu chữ của
 *         hàng — hàng đang mở đậm hơn hàng thường, thế là đủ, không cần thêm một màu nhấn.
 */
function navRowClass(isActive: boolean): string {
  return cn(
    "flex h-10 items-center gap-3 overflow-hidden rounded-lg px-[13px] text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  )
}

/**
 * Input: `onNavigate` — gọi sau khi bấm vào một nav (bản mobile dùng để đóng tấm trượt).
 * Output: Ruột của sidebar: khối logo, danh sách nav, rồi nút tài khoản ép xuống đáy.
 *
 *         Dùng chung cho cả cột trên desktop và tấm trượt trên mobile — hai chỗ hiển thị, một
 *         định nghĩa. Vì vậy MỌI lớp phụ thuộc trạng thái thu gọn đều có tiền tố `md:`: tấm
 *         trượt trên mobile luôn rộng nên luôn hiện đầy đủ chữ, bất kể cột desktop đang thu hay
 *         mở. Cùng cách hub làm (components/sidebar/sidebar-nav.tsx).
 *
 *         Thu gọn cho chữ `opacity` về 0 chứ không tháo khỏi DOM: tháo ra thì chữ mất tức thời
 *         trong khi cột còn đang hẹp dần, và mỗi lần mở lại là một lượt mount mới cho cả nav.
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
    <div className="group/rail flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Khối logo cao 64px, khớp bề rộng rail nên khi thu, icon Joytab nằm giữa ô vuông 64×64. */}
      <div className="flex h-16 shrink-0 items-center">
        {/* Bản rail: MỘT nút duy nhất chiếm cả ô 64px, hiện icon Joytab và đổi sang mũi thu/mở khi
            hover — đúng cách hub làm (components/sidebar/sidebar-brand.tsx). Một nút chứ không
            phải "icon + nút hiện khi hover" để bàn phím Tab tới được: rail 64px không có chỗ cho
            nút thường trực, mà thu gọn rồi không mở lại được bằng bàn phím thì là lỗi thật.
            Đổi thẳng, không cross-fade.

            Vùng hover là `group/rail` — CẢ cột, không riêng ô logo 64×64. Bắt hover trên chính
            ô logo thì phải rê trúng một ô nhỏ mới biết chỗ đó bấm được, tức là phải đoán trước
            mới tìm ra; rê vào cột là thấy mũi mở, không cần biết trước. */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Mở thanh điều hướng"
          className={cn(
            "hidden size-16 shrink-0 cursor-pointer items-center justify-center text-sidebar-foreground/70 outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 focus-visible:ring-inset sidebar-closed:md:flex",
          )}
        >
          <JoytabLogo iconOnly className="h-8 w-auto group-hover/rail:hidden" />
          <PanelLeft
            className="hidden size-5 rotate-180 group-hover/rail:block"
            aria-hidden="true"
          />
        </button>

        {/* Bản đầy đủ: logo bên trái, nút thu bên phải. Luôn hiện trên mobile vì tấm trượt rộng,
            ở đó không có khái niệm thu gọn. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sidebar-closed:md:hidden">
          <Link
            href={`/orgs/${activeId}`}
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
            aria-label="Joytab — trang chủ tổ chức"
          >
            <JoytabLogo className="h-11 w-auto" />
          </Link>

          {/* Icon trơn, không dùng component Button: không nền hover, không viền, không cú nhấn
              1px khi bấm. */}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label="Thu gọn thanh điều hướng"
            className="hidden shrink-0 cursor-pointer rounded-md p-1 text-sidebar-foreground/70 outline-none hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 md:block"
          >
            <PanelLeft className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav
        aria-label="Điều hướng tổ chức"
        className={cn(
          // pt-8 giãn nav xuống khỏi khối logo (hub cũng giãn, ở mức pt-4): logo là nhận diện,
          // nav là điều hướng — dán sát nhau thì mắt đọc thành một danh sách mà dòng đầu vô tình
          // trông như một mục bấm được.
          "flex min-h-0 flex-1 flex-col gap-2 px-3 pt-8 pb-2 sidebar-closed:md:px-2.5",
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
                className={navRowClass(isActive)}
              >
                <Icon className="size-5 shrink-0 text-current" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left sidebar-closed:md:opacity-0">
                  {item.label}
                </span>
              </Link>
            </RailTooltip>
          )
        })}

        {/* mt-auto đẩy xuống sát đường kẻ của footer: nó vẫn là một mục điều hướng nên ở TRÊN
            đường kẻ, cùng khối với nav — nhưng là thứ "về tôi" chứ không thuộc tổ chức đang xem,
            nên nằm cách xa nav tổ chức thay vì dán ngay dưới chúng. */}
        <RailTooltip label="Thông tin cá nhân" enabled={collapsed}>
          <Link
            href="/me"
            onClick={onNavigate}
            aria-current={pathname === "/me" ? "page" : undefined}
            className={cn("mt-auto", navRowClass(pathname === "/me"))}
          >
            <CircleUser className="size-5 shrink-0 text-current" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left sidebar-closed:md:opacity-0">
              Thông tin cá nhân
            </span>
          </Link>
        </RailTooltip>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-2 sidebar-closed:md:px-2.5">
        <SidebarProfileMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
