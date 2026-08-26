import { JoytabLogo } from "@/components/common/joytab-logo"
import { LogoutButton } from "@/components/common/logout-button"
import { ThemeModeButton } from "@/components/common/theme-mode-button"

/**
 * Input: Không nhận props.
 * Output: Header dùng chung cho mọi trang đã đăng nhập: logo + đổi sáng/tối + đăng xuất.
 *
 *         Là server component: hai nút bên trong đã tự là client component, header chỉ xếp
 *         chỗ nên không cần gửi JS gì thêm xuống browser.
 *
 *         Cố tình chưa có nav/menu — chỉ thêm khi có trang thứ hai để đi tới.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <JoytabLogo className="h-7 w-auto" />
        <div className="flex items-center gap-2">
          <ThemeModeButton />
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
