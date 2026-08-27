import { JoytabLogo } from "@/components/common/joytab-logo"
import { ThemeModeButton } from "@/components/common/theme-mode-button"
import { UserMenu } from "@/components/common/user-menu"

/**
 * Input: Không nhận props.
 * Output: Header full-width cho nhóm route `(plain)` — những trang đã đăng nhập nhưng CHƯA gắn
 *         với tổ chức nào (`/` khi user chưa vào tổ chức, `/join/<mã>`): logo + đổi sáng/tối +
 *         avatar user (bấm vào mở dropdown có nút đăng xuất).
 *
 *         Khu vực tổ chức KHÔNG dùng header này — ở đó logo nằm trong sidebar và thanh trên chỉ
 *         còn hai nút bên phải (xem app-shell.tsx).
 *
 *         Là server component: các nút bên trong đã tự là client component, header chỉ xếp
 *         chỗ nên không cần gửi JS gì thêm xuống browser.
 *
 *         max-w-7xl khớp với vùng nội dung bên dưới — hai mép phải thẳng hàng nhau.
 *
 *         Cố tình không có nav: hai trang dùng header này đều là ngã ba một lối, chưa có gì để
 *         đi tới.
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
