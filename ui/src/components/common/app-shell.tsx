import { AppSidebar } from "@/components/common/app-sidebar"
import { SidebarProvider } from "@/components/common/sidebar-provider"
import { SidebarToggle } from "@/components/common/sidebar-toggle"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Input: `sidebarOpen` (layout đọc từ cookie `sb`) + nội dung trang của một tổ chức.
 * Output: Khung hai cột của khu vực tổ chức: sidebar chạy suốt chiều cao bên trái, bên phải là
 *         thanh trên chỉ có nút thu/mở rồi tới nội dung.
 *
 *         Thu gọn là co về RAIL 64px chứ không về 0 (giống hub): rail vẫn giữ được icon của
 *         từng nav nên đi lại được mà không cần mở lại cột, và mép trái không bị trống hoác.
 *         64px cũng là chiều cao khối logo, nên lúc thu icon Joytab nằm giữa một ô vuông.
 *
 *         Co bằng CSS (`group-data-[sidebar=closed]`) chứ không tháo khỏi cây React: tháo ra
 *         thì mỗi lần mở lại là một lượt mount mới — mất transition và nav render lại từ đầu.
 *
 *         Header cố tình trống ngoài nút toggle: logo nằm trong sidebar, còn tài khoản/giao
 *         diện/chuyển tổ chức đã gom hết vào menu ở đáy sidebar.
 *
 *         Dưới `md` sidebar không có trong luồng: màn 360px không đủ chỗ cho cột 248px cộng
 *         nội dung, nên ở đó nút toggle mở tấm trượt (xem SidebarToggle).
 *
 *         TooltipProvider bọc ở đây chứ không ở từng chỗ dùng: rail cần tooltip cho cả nav lẫn
 *         nút tài khoản, một provider cho cả khung thì độ trễ hover giống nhau ở mọi hàng.
 *
 *         Là server component: mọi thứ tương tác bên trong đã tự là client component.
 */
export function AppShell({
  sidebarOpen,
  children,
}: {
  sidebarOpen: boolean
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <SidebarProvider initialOpen={sidebarOpen}>
        <aside className="sticky top-0 hidden h-svh w-62 shrink-0 overflow-hidden border-r transition-[width] duration-200 ease-out group-data-[sidebar=closed]/sidebar:w-16 md:block">
          <div className="h-full w-full">
            <AppSidebar />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <SidebarToggle />
          </header>

          {children}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
