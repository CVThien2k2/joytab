"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Building2,
  Check,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Moon,
  Plus,
  Sun,
} from "lucide-react"
import { setActiveOrganization } from "@/api/organizations.actions"
import { CreateOrganizationDialog } from "@/app/(private)/_components/create-organization-dialog"
import { JoinOrganizationDialog } from "@/app/(private)/_components/join-organization-dialog"
import { AccountAvatar } from "@/components/common/account-avatar"
import { RailTooltip } from "@/components/common/rail-tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { useLogout } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/providers/auth-store-provider"
import { useOrganizationStore } from "@/providers/organization-store-provider"

/** Dialog nào đang mở — hai dialog dùng chung một ô state nên không mở được cả hai cùng lúc. */
type OpenDialog = "join" | "create" | null

/** Ba lựa chọn giao diện, khớp với `enableSystem` của ThemeProvider. */
const THEME_OPTIONS = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo hệ thống", icon: MonitorSmartphone },
] as const

/**
 * Input: `onNavigate` — gọi sau khi chuyển tổ chức (bản mobile dùng để đóng tấm trượt).
 * Output: Nút profile user ở đáy sidebar (avatar + tên), bấm ra MỘT menu gom mọi việc "về tôi và
 *         không gian làm việc của tôi": chuyển tổ chức, tham gia/tạo tổ chức, đổi giao diện,
 *         đăng xuất.
 *
 *         Menu KHÔNG nhắc lại tên/email user: nút mở nó đã hiện ngay đó rồi, lặp lại chỉ đẩy
 *         mọi thứ khác xuống thêm một dòng.
 *
 *         `collapsed` chỉ đổi cái NÚT (tên mờ đi, còn lại avatar, hover ra tooltip), không đổi
 *         nội dung menu: menu bung ra ngoài rail nên lúc nào cũng có chỗ.
 *
 *         Gom một cửa thay vì rải mỗi thứ một nút trên header: những việc này đều hiếm (vài
 *         lần một tuần), mà nút thường trực thì tốn chỗ thường trực.
 *
 *         Hai dialog nằm NGOÀI dropdown và chỉ nhận state: Radix đóng dropdown khi chọn item,
 *         dialog nào nằm trong item sẽ bị unmount ngay lúc vừa mở.
 *
 *         Chuyển tổ chức làm hai việc theo đúng thứ tự: ghi cookie (để lần vào `/` sau về đúng
 *         đây) rồi mới điều hướng. Đổi thứ tự thì F5 ngay sau khi chuyển sẽ nhảy về tổ chức cũ.
 */
export function SidebarProfileMenu({
  collapsed = false,
  onNavigate,
}: {
  /** Cột đang thu thành rail. Chỉ dùng để BẬT tooltip; nhãn mờ đi bằng biến `sidebar-closed`. */
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const organizations = useOrganizationStore((state) => state.organizations)
  const activeId = useOrganizationStore((state) => state.activeOrganizationId)
  const logout = useLogout()
  const { theme, setTheme } = useTheme()
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const [isSwitching, startSwitching] = useTransition()

  const active = organizations.find((organization) => organization.id === activeId)

  // Cả hai nhánh này là bất khả trong luồng thật (layout đã kiểm user và orgId trước khi
  // render), nhưng im lặng còn hơn ném lỗi làm sập cả sidebar vì một cái nhãn.
  if (!user || !active) return null

  const displayName = user.user.fullName?.trim() || user.user.email

  /**
   * Input: id tổ chức user vừa chọn.
   * Output: Ghi nhớ lựa chọn rồi sang trang thông tin của tổ chức đó. Chọn lại đúng tổ chức
   *         đang xem thì không làm gì — chỉ đóng menu.
   */
  function switchTo(organizationId: string): void {
    if (organizationId === activeId) return
    startSwitching(async () => {
      await setActiveOrganization(organizationId)
      router.push(`/orgs/${organizationId}`)
      onNavigate?.()
    })
  }

  return (
    <>
      <DropdownMenu>
        <RailTooltip label={displayName} enabled={collapsed}>
          <DropdownMenuTrigger asChild disabled={isSwitching}>
            <button
              type="button"
              className="flex h-12 w-full items-center gap-3 overflow-hidden rounded-lg px-[13px] text-left whitespace-nowrap transition-colors outline-none hover:bg-sidebar-accent/60 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50 disabled:opacity-60"
              aria-label="Mở menu tài khoản"
            >
              <AccountAvatar name={displayName} src={user.user.avatarUrl} size={26} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium sidebar-closed:md:opacity-0">
                {displayName}
              </span>
              {isSwitching ? <Spinner className="size-4 shrink-0 text-muted-foreground" /> : null}
            </button>
          </DropdownMenuTrigger>
        </RailTooltip>

        <DropdownMenuContent side="top" align="start" className="w-72">
          {/* Hàng đầu là tổ chức ĐANG xem, không phải cả danh sách: đa số người chỉ thuộc một
              tổ chức, mà menu mở ra đã thấy một danh sách dài thì việc thường ngày (đổi giao
              diện, đăng xuất) bị đẩy xuống dưới. Danh sách nằm trong submenu — hover mới bung.
              Đây cũng là chỗ duy nhất trong sidebar nói ra đang ở tổ chức nào khi cột bị thu. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {/* Một dòng, icon cùng cỡ với "Giao diện" và "Đăng xuất" — ba hàng của menu này
                  cao bằng nhau. Bỏ vai trò ở đây: nó là thông tin của trang Thông tin tổ chức,
                  còn menu này chỉ cần trả lời "đang ở tổ chức nào". Vai trò vẫn có trong
                  submenu, nơi nó thật sự giúp phân biệt các tổ chức với nhau. */}
              <Building2 aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{active.name}</span>
            </DropdownMenuSubTrigger>

            {/* align="end" = bám mép DƯỚI của item, nên submenu trải LÊN. Menu tài khoản nằm
                ở đáy sidebar; mặc định của Radix là bám mép trên (trải xuống), tức là trải
                thẳng ra ngoài đáy màn hình rồi bị Radix lật ngược lại — một nhịp nhảy. */}
            <DropdownMenuSubContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Tổ chức của bạn
              </DropdownMenuLabel>

              {/* Mỗi tổ chức một dòng, icon cùng cỡ với hai mục dưới — mọi hàng trong submenu
                  cao bằng nhau. Vai trò và số thành viên bỏ ở đây: chọn tổ chức thì chỉ cần
                  đọc tên, còn hai con số kia đã nằm ngay trang Thông tin tổ chức. */}
              {organizations.map((organization) => (
                <DropdownMenuItem key={organization.id} onSelect={() => switchTo(organization.id)}>
                  <Building2 aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                  {organization.id === activeId ? (
                    <Check className="size-4 shrink-0" aria-label="Đang xem" />
                  ) : null}
                </DropdownMenuItem>
              ))}

              <DropdownMenuItem onSelect={() => setOpenDialog("join")}>
                <KeyRound aria-hidden="true" />
                Tham gia bằng mã
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenDialog("create")}>
                <Plus aria-hidden="true" />
                Tạo tổ chức
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {/* Icon theo màu ĐANG hiển thị, đổi bằng variant `dark:` — cùng cách
                  ThemeModeButton đang làm. Không đọc `theme` để chọn icon vì next-themes chỉ
                  biết giá trị thật sau khi mount: server render ra một icon, client render ra
                  icon khác thì lệch hydrate. Lựa chọn đang lưu vẫn thấy được ở dấu chọn trong
                  submenu, nên không mất thông tin gì. */}
              <Sun className="dark:hidden" aria-hidden="true" />
              <Moon className="hidden dark:block" aria-hidden="true" />
              Giao diện
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                {THEME_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      <Icon aria-hidden="true" />
                      {option.label}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            variant="destructive"
            disabled={logout.isPending}
            onSelect={() => logout.mutate()}
          >
            <LogOut aria-hidden="true" />
            {logout.isPending ? "Đang đăng xuất" : "Đăng xuất"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <JoinOrganizationDialog
        open={openDialog === "join"}
        onOpenChange={(open) => setOpenDialog(open ? "join" : null)}
      />
      <CreateOrganizationDialog
        open={openDialog === "create"}
        onOpenChange={(open) => setOpenDialog(open ? "create" : null)}
      />
    </>
  )
}
