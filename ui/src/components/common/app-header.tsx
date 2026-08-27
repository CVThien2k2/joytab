import { JoytabLogo } from "@/components/common/joytab-logo"
import { ThemeModeButton } from "@/components/common/theme-mode-button"
import { UserMenu } from "@/components/common/user-menu"

/**
 * Input: Không nhận props.
 * Output: Header dùng chung cho mọi trang đã đăng nhập: logo + đổi sáng/tối + avatar user
 *         (bấm vào mở dropdown có nút đăng xuất).
 *
 *         Là server component: các nút bên trong đã tự là client component, header chỉ xếp
 *         chỗ nên không cần gửi JS gì thêm xuống browser.
 *
 *         max-w-7xl khớp với vùng nội dung bên dưới — hai mép phải thẳng hàng nhau.
 *
 *         Cố tình chưa có nav/menu — chỉ thêm khi có trang thứ hai để đi tới.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <JoytabLogo className="h-7 w-auto" />
        <div className="flex items-center gap-2">
          <ThemeModeButton size="default" />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
