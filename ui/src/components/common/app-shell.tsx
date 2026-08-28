import { AppBreadcrumb } from "@/components/common/app-breadcrumb"
import { AppSidebar } from "@/components/common/app-sidebar"
import { SidebarDrawerButton } from "@/components/common/sidebar-drawer-button"
import { SidebarProvider } from "@/components/common/sidebar-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Input: Nội dung trang của một tổ chức.
 * Output: Khung hai cột của khu vực tổ chức: sidebar chạy suốt chiều cao bên trái, bên phải là
 *         thanh trên mang breadcrumb rồi tới nội dung.
 *
 *         Thu gọn là co về RAIL 64px chứ không về 0 (giống hub): rail vẫn giữ được icon của
 *         từng nav nên đi lại được mà không cần mở lại cột, và mép trái không bị trống hoác.
 *         64px cũng là chiều cao khối logo, nên lúc thu icon Joytab nằm giữa một ô vuông.
 *
 *         Co bằng CSS (biến `sidebar-closed`, bám dấu `data-sidebar` trên `<html>`) chứ không
 *         tháo khỏi cây React: tháo ra thì mỗi lần mở lại là một lượt mount mới cho toàn bộ nav.
 *         Dấu đó do script trong app/layout.tsx đặt trước khi trang được vẽ, nên bề rộng đúng
 *         ngay khung hình đầu, không phụ thuộc React đã hydrate hay chưa.
 *
 *         Bề rộng có transition 200ms để thu/mở trông liền mạch — nhưng nút bấm thì KHÔNG có
 *         hiệu ứng nào (xem AppSidebar): cột chạy là đủ, nút nhảy theo nữa thì thành hai chuyển
 *         động cùng lúc.
 *
 *         Header mang breadcrumb (đóng vai trò tiêu đề trang, như hub) chứ không mang nút thu/mở
 *         nữa — nút đó đã dời vào trong sidebar, nơi nó nằm cạnh chính cái nó điều khiển.
 *
 *         Dưới `md` sidebar không có trong luồng: màn 360px không đủ chỗ cho cột 248px cộng nội
 *         dung, nên ở đó vào sidebar bằng tấm trượt (xem SidebarDrawerButton).
 *
 *         TooltipProvider bọc ở đây chứ không ở từng chỗ dùng: rail cần tooltip cho cả nav lẫn
 *         nút tài khoản, một provider cho cả khung thì độ trễ hover giống nhau ở mọi hàng.
 *
 *         Là server component: mọi thứ tương tác bên trong đã tự là client component.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <aside className="sticky top-0 hidden h-svh w-62 shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:block sidebar-closed:md:w-16">
          <div className="h-full w-full">
            <AppSidebar />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <SidebarDrawerButton />
            <div className="min-w-0 flex-1">
              <AppBreadcrumb />
            </div>
          </header>

          {children}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
