"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, CalendarRange, CircleUser, PanelLeft, Receipt } from "lucide-react"
import { JoytabLogo } from "@/components/common/joytab-logo"
import { RailTooltip } from "@/components/common/rail-tooltip"
import { SidebarProfileMenu } from "@/components/common/sidebar-profile-menu"
import { useSidebar } from "@/components/common/sidebar-provider"
import { useOrganizationStore } from "@/providers/organization-store-provider"
import { cn } from "@/lib/utils"

/**
 * Nav của tổ chức đang chọn. `segment` rỗng = chính `/orgs/<id>`, và mục đó phải so BẰNG chứ
 * không `startsWith`: nó là tiền tố của mọi trang con nên startsWith sẽ làm nó sáng cùng lúc
 * với mục con.
 */
const ORGANIZATION_ITEMS = [
  { segment: "", label: "Tổng quan", icon: Building2 },
  { segment: "matches", label: "Lịch thi đấu", icon: CalendarRange },
  { segment: "payments", label: "Thanh toán", icon: Receipt },
] as const

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
 * Input: Tiêu đề nhóm + trạng thái thu gọn.
 * Output: Nhãn nhóm ("Cá nhân" / "Tổ chức"), hoặc một đường kẻ khi sidebar đã thu.
 *
 *         Thu rồi thì chữ không còn chỗ, nhưng ranh giới giữa hai nhóm vẫn phải thấy được —
 *         bỏ hẳn nhãn đi thì rail thành một dãy bảy icon không có nhóm nào.
 */
function GroupLabel({
  children,
  collapsed,
  className,
}: {
  children: React.ReactNode
  collapsed: boolean
  className?: string
}) {
  if (collapsed) {
    return (
      <div
        aria-hidden="true"
        className={cn("mx-2 hidden h-px bg-sidebar-border sidebar-closed:md:block", className)}
      />
    )
  }

  return (
    <p
      className={cn(
        "px-[13px] pt-2 pb-1 text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase sidebar-closed:md:hidden",
        className,
      )}
    >
      {children}
    </p>
  )
}

/** Một hàng nav. Tách ra vì hai nhóm dùng chung markup — hai bản chép tay sẽ trôi khác nhau. */
function NavRow({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  onNavigate,
  className,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
  className?: string
}) {
  return (
    <RailTooltip label={label} enabled={collapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cn(className, navRowClass(isActive))}
      >
        <Icon className="size-5 shrink-0 text-current" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left sidebar-closed:md:opacity-0">
          {label}
        </span>
      </Link>
    </RailTooltip>
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
        aria-label="Điều hướng"
        className={cn(
          // pt-8 giãn nav xuống khỏi khối logo (hub cũng giãn, ở mức pt-4): logo là nhận diện,
          // nav là điều hướng — dán sát nhau thì mắt đọc thành một danh sách mà dòng đầu vô tình
          // trông như một mục bấm được.
          "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-8 pb-2 sidebar-closed:md:px-2.5",
        )}
      >
        {/* Nhóm tổ chức chỉ dựng được khi đã có tổ chức đang chọn. Trang cá nhân của người chưa
            vào tổ chức nào không đi qua khung này, nhưng vẫn kiểm ở đây để không bao giờ render
            ra một đường dẫn `/orgs//matches`. */}
        {activeId ? (
          <>
            <GroupLabel collapsed={collapsed}>Tổ chức</GroupLabel>
            {ORGANIZATION_ITEMS.map((item) => {
              const href = item.segment ? `/orgs/${activeId}/${item.segment}` : `/orgs/${activeId}`
              const isActive = item.segment ? pathname.startsWith(href) : pathname === href
              return (
                <NavRow
                  key={item.label}
                  href={href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              )
            })}
          </>
        ) : null}

        {/* mt-auto đẩy xuống sát đường kẻ của footer. Đứng RIÊNG, không nằm trong nhóm nào:
            nó là thứ "về tôi" — tài khoản, chứ không phải một mục nghiệp vụ như lịch hay
            thanh toán. Gom vào nhóm Cá nhân thì hai loại khác hẳn nhau nằm chung một danh
            sách, mà nó cũng mất luôn vị trí cố định ở đáy cột. */}
        <NavRow
          href="/me"
          label="Thông tin cá nhân"
          icon={CircleUser}
          isActive={pathname === "/me"}
          collapsed={collapsed}
          onNavigate={onNavigate}
          className="mt-auto"
        />
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-2 sidebar-closed:md:px-2.5">
        <SidebarProfileMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
